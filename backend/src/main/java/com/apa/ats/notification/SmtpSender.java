package com.apa.ats.notification;

import com.apa.ats.config.AtsProperties.Mail;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import org.springframework.stereotype.Component;

/**
 * A minimal SMTP client over plain sockets (the JDK only; no mail library is available offline).
 * One message per connection: EHLO, optional STARTTLS, optional AUTH LOGIN, MAIL FROM, RCPT TO, DATA, QUIT.
 * The body travels base64-encoded, so no dot-stuffing is needed.
 */
@Component
public class SmtpSender {

    static final int TIMEOUT_MS = 15_000;
    private static final Pattern ADDRESS = Pattern.compile("[^\\s<>@\"]+@[^\\s<>@\"]+");
    private static final String CRLF = "\r\n";

    /** Sends one plain-text message. Throws IOException with a readable reason on any failure. */
    public void send(Mail cfg, String to, String subject, String text) throws IOException {
        if (cfg.host() == null || cfg.host().isBlank()) throw new IOException("ATS_MAIL_HOST is not set.");
        String from = headerSafe(cfg.from());
        if (from.isEmpty()) throw new IOException("ATS_MAIL_FROM is not set.");
        String fromAddress = bareAddress(from);
        String toAddress = bareAddress(headerSafe(to));
        if (!ADDRESS.matcher(fromAddress).matches()) throw new IOException("The sender address is not valid.");
        if (!ADDRESS.matcher(toAddress).matches()) throw new IllegalArgumentException("The recipient address is not valid.");

        String host = cfg.host().strip();
        int port = cfg.port() > 0 ? cfg.port() : 25;
        Socket socket = new Socket();
        try {
            socket.connect(new InetSocketAddress(host, port), TIMEOUT_MS);
            socket.setSoTimeout(TIMEOUT_MS);
            Conn c = new Conn(socket);
            c.expect("greeting", 220);
            c.command("EHLO " + localName(), "EHLO", 250);

            if (cfg.starttls()) {
                c.command("STARTTLS", "STARTTLS", 220);
                SSLSocket tls = (SSLSocket) ((SSLSocketFactory) SSLSocketFactory.getDefault()).createSocket(socket, host, port, true);
                SSLParameters params = tls.getSSLParameters();
                params.setEndpointIdentificationAlgorithm("HTTPS"); // the certificate must match the host
                tls.setSSLParameters(params);
                tls.setSoTimeout(TIMEOUT_MS);
                tls.startHandshake();
                socket = tls;
                c = new Conn(tls);
                c.command("EHLO " + localName(), "EHLO", 250);
            }

            if (cfg.username() != null && !cfg.username().isBlank()) {
                c.command("AUTH LOGIN", "AUTH", 334);
                c.command(b64(cfg.username()), "AUTH", 334);
                c.command(b64(cfg.password() == null ? "" : cfg.password()), "AUTH", 235);
            }

            c.command("MAIL FROM:<" + fromAddress + ">", "MAIL FROM", 250);
            c.command("RCPT TO:<" + toAddress + ">", "RCPT TO", 250, 251);
            c.command("DATA", "DATA", 354);
            c.raw(message(from, toAddress, subject, text, fromAddress));
            c.expect("message body", 250);
            try {
                c.command("QUIT", "QUIT", 221);
            } catch (IOException ignored) {
                // The message was accepted; a sloppy goodbye is not a failure.
            }
        } finally {
            try { socket.close(); } catch (IOException ignored) { /* nothing left to do */ }
        }
    }

    /* ------------------------------------------------------------------ message */

    static String message(String from, String to, String subject, String text, String fromAddress) {
        String domain = fromAddress.substring(fromAddress.indexOf('@') + 1);
        String body = Base64.getMimeEncoder(76, CRLF.getBytes(StandardCharsets.US_ASCII))
                .encodeToString((text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
        return "From: " + from + CRLF
                + "To: <" + to + ">" + CRLF
                + "Subject: " + encodeSubject(subject) + CRLF
                + "Date: " + DateTimeFormatter.RFC_1123_DATE_TIME.format(ZonedDateTime.now()) + CRLF
                + "Message-ID: <" + UUID.randomUUID() + "@" + domain + ">" + CRLF
                + "MIME-Version: 1.0" + CRLF
                + "Content-Type: text/plain; charset=UTF-8" + CRLF
                + "Content-Transfer-Encoding: base64" + CRLF
                + CRLF
                + body + CRLF
                + "." + CRLF;
    }

    /** RFC 2047: plain when it is short printable ASCII, otherwise UTF-8 B-encoded words of at most 75 characters. */
    static String encodeSubject(String subject) {
        String s = headerSafe(subject);
        if (s.length() <= 60 && s.chars().allMatch(ch -> ch >= 32 && ch < 127)) return s;
        StringBuilder out = new StringBuilder();
        StringBuilder chunk = new StringBuilder();
        int chunkBytes = 0;
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            String ch = new String(Character.toChars(cp));
            int n = ch.getBytes(StandardCharsets.UTF_8).length;
            if (chunkBytes + n > 42) { // 42 bytes -> 56 base64 characters, plus the 12-character wrapper
                appendWord(out, chunk);
                chunk.setLength(0);
                chunkBytes = 0;
            }
            chunk.append(ch);
            chunkBytes += n;
            i += Character.charCount(cp);
        }
        appendWord(out, chunk);
        return out.toString();
    }

    private static void appendWord(StringBuilder out, CharSequence chunk) {
        if (chunk.length() == 0) return;
        if (out.length() > 0) out.append(CRLF).append(' ');
        out.append("=?UTF-8?B?").append(b64(chunk.toString())).append("?=");
    }

    private static String b64(String s) {
        return Base64.getEncoder().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    /** Header values must never carry a line break (header injection). */
    private static String headerSafe(String s) {
        return s == null ? "" : s.replaceAll("[\\r\\n]+", " ").strip();
    }

    /** "Name <a@b>" -> "a@b". */
    private static String bareAddress(String s) {
        int lt = s.lastIndexOf('<');
        int gt = s.lastIndexOf('>');
        return lt >= 0 && gt > lt ? s.substring(lt + 1, gt).strip() : s;
    }

    private static String localName() {
        return "ats.local";
    }

    /* ------------------------------------------------------------------ wire */

    /** One SMTP connection: sends CRLF-terminated lines and reads (possibly multi-line) replies. */
    private static final class Conn {
        private final BufferedReader in;
        private final OutputStream out;

        Conn(Socket socket) throws IOException {
            this.in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.ISO_8859_1));
            this.out = socket.getOutputStream();
        }

        /** Sends one line, then checks the reply code. {@code label} is what errors call it (never the secret). */
        void command(String line, String label, int... ok) throws IOException {
            raw(line + CRLF);
            expect(label, ok);
        }

        void raw(String data) throws IOException {
            out.write(data.getBytes(StandardCharsets.ISO_8859_1));
            out.flush();
        }

        void expect(String label, int... ok) throws IOException {
            String last;
            while (true) {
                last = in.readLine();
                if (last == null) throw new IOException("The mail server closed the connection (" + label + ").");
                // "250-text" continues; "250 text" (or just "250") ends the reply.
                if (last.length() < 4 || last.charAt(3) != '-') break;
            }
            int code;
            try {
                code = Integer.parseInt(last.substring(0, Math.min(3, last.length())));
            } catch (NumberFormatException e) {
                throw new IOException("Unexpected reply from the mail server (" + label + ").");
            }
            for (int c : ok) if (c == code) return;
            String reason = last.length() > 4 ? last.substring(4) : "";
            throw new IOException("Mail server refused " + label + ": " + code + " " + reason);
        }
    }
}
