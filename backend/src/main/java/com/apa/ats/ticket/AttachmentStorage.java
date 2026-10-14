package com.apa.ats.ticket;

import com.apa.ats.common.ApiException;
import com.apa.ats.config.AtsProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Attachment files on disk, as {@code <dir>/<yyyy>/<MM>/<uuid>}. Nothing user-controlled ends up in
 * the path: the original name is metadata only. Files are checked (type, size, signature) before any write.
 */
@Slf4j
@Component
public class AttachmentStorage {

    /** Allowed extensions and the content type each is served as (never taken from the client). */
    private static final Map<String, String> TYPES = Map.ofEntries(
            Map.entry("png", "image/png"), Map.entry("jpg", "image/jpeg"), Map.entry("jpeg", "image/jpeg"),
            Map.entry("gif", "image/gif"), Map.entry("webp", "image/webp"), Map.entry("pdf", "application/pdf"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("csv", "text/csv"), Map.entry("txt", "text/plain"), Map.entry("log", "text/plain"),
            Map.entry("sql", "text/plain"));

    private static final Pattern KEY = Pattern.compile("\\d{4}/\\d{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    /** A file that passed the checks: cleaned name and the content type it will be served as. */
    public record Checked(MultipartFile file, String fileName, String contentType) {}

    /** A file written to disk. */
    public record Stored(String key, long size, String sha256) {}

    private final Path root;
    private final int maxMb;

    public AttachmentStorage(AtsProperties props) {
        this.root = Path.of(props.attachments().dir()).toAbsolutePath().normalize();
        this.maxMb = props.attachments().maxMb();
    }

    public int maxMb() { return maxMb; }

    /** Validates type, size and (for images, PDF and Excel) the file signature. Writes nothing. */
    public Checked check(MultipartFile f) {
        String name = cleanName(f.getOriginalFilename());
        String ext = extension(name);
        String type = TYPES.get(ext);
        if (type == null) {
            throw ApiException.badRequest("BAD_FILE_TYPE", "\"" + name + "\" isn't an allowed file type. Use PNG, JPG, GIF, WebP, PDF, Excel, CSV, TXT, LOG or SQL.");
        }
        if (f.getSize() <= 0) throw ApiException.badRequest("EMPTY_FILE", "\"" + name + "\" is empty.");
        if (f.getSize() > maxMb * 1024L * 1024L) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "\"" + name + "\" is too large. The limit is " + maxMb + " MB per file.");
        }
        if (!signatureOk(ext, head(f))) {
            throw ApiException.badRequest("BAD_FILE_TYPE", "\"" + name + "\" doesn't look like a real ." + ext + " file.");
        }
        return new Checked(f, name, type);
    }

    /** Streams the file to disk while hashing it. */
    public Stored store(MultipartFile f) {
        LocalDate d = LocalDate.now();
        String key = "%04d/%02d/%s".formatted(d.getYear(), d.getMonthValue(), UUID.randomUUID());
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            long size;
            try (InputStream in = new DigestInputStream(f.getInputStream(), sha);
                 OutputStream out = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW)) {
                size = in.transferTo(out);
            }
            return new Stored(key, size, HexFormat.of().formatHex(sha.digest()));
        } catch (IOException | NoSuchAlgorithmException e) {
            log.error("Couldn't write attachment {}", target, e);
            delete(key);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_FAILED",
                    "The file couldn't be saved on the server. Try again, and contact the administrator if it persists.");
        }
    }

    /** The file for a stored key; the key shape is verified so it can never point outside the storage folder. */
    public Path resolve(String key) {
        if (key == null || !KEY.matcher(key).matches()) throw new IllegalArgumentException("Bad storage key");
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) throw new IllegalArgumentException("Bad storage key");
        return p;
    }

    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException | RuntimeException e) {
            log.warn("Couldn't remove attachment file {}", key, e);
        }
    }

    /* ------------------------------------------------------------------ names and signatures */

    /** Base name only, no control or direction-override characters, at most 255 characters (extension kept). */
    static String cleanName(String raw) {
        String n = raw == null ? "" : raw;
        n = n.substring(Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\')) + 1);
        n = n.replaceAll("[\\p{Cc}\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]", "").replaceAll("[<>:\"|?*]", "_").strip();
        if (n.isEmpty() || n.equals(".") || n.equals("..")) return "file";
        if (n.length() > 255) {
            String ext = extension(n);
            if (ext.isEmpty() || ext.length() > 20) return n.substring(0, 255);
            n = n.substring(0, 255 - ext.length() - 1) + "." + ext;
        }
        return n;
    }

    static String extension(String name) {
        int i = name == null ? -1 : name.lastIndexOf('.');
        return i < 0 ? "" : name.substring(i + 1).toLowerCase(Locale.ROOT);
    }

    private static byte[] head(MultipartFile f) {
        try (InputStream in = f.getInputStream()) {
            return in.readNBytes(1024);
        } catch (IOException e) {
            throw ApiException.badRequest("UNREADABLE_FILE", "The file couldn't be read. Try attaching it again.");
        }
    }

    private static boolean signatureOk(String ext, byte[] h) {
        return switch (ext) {
            case "png" -> startsWith(h, 0, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A);
            case "jpg", "jpeg" -> startsWith(h, 0, 0xFF, 0xD8, 0xFF);
            case "gif" -> h.length >= 6 && startsWith(h, 0, 'G', 'I', 'F', '8') && (h[4] == '7' || h[4] == '9') && h[5] == 'a';
            case "webp" -> startsWith(h, 0, 'R', 'I', 'F', 'F') && startsWith(h, 8, 'W', 'E', 'B', 'P');
            case "pdf" -> new String(h, StandardCharsets.ISO_8859_1).contains("%PDF-");
            case "xlsx" -> startsWith(h, 0, 'P', 'K', 0x03, 0x04);
            case "xls" -> startsWith(h, 0, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);
            default -> true; // csv, txt, log, sql: plain text, nothing to match
        };
    }

    private static boolean startsWith(byte[] h, int at, int... expected) {
        if (h.length < at + expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if ((h[at + i] & 0xFF) != expected[i]) return false;
        }
        return true;
    }
}
