package com.apa.ats.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.apa.ats.config.AtsProperties.Mail;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;

class SmtpSenderTest {

    /** A one-shot fake SMTP server that records what the client sends. */
    private static final class Fake implements AutoCloseable {
        final ServerSocket server;
        final List<String> lines = new ArrayList<>();
        final Thread thread;

        Fake(int dataReplyCode) throws IOException {
            server = new ServerSocket(0);
            thread = new Thread(() -> {
                try (Socket s = server.accept()) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.ISO_8859_1));
                    OutputStream out = s.getOutputStream();
                    send(out, "220 hello");
                    String line;
                    boolean data = false;
                    while ((line = in.readLine()) != null) {
                        lines.add(line);
                        if (data) {
                            if (line.equals(".")) { data = false; send(out, dataReplyCode + " done"); }
                            continue;
                        }
                        if (line.startsWith("EHLO")) send(out, "250-ats.test\r\n250-SIZE 1000\r\n250 8BITMIME");
                        else if (line.startsWith("DATA")) { data = true; send(out, "354 go"); }
                        else if (line.startsWith("QUIT")) { send(out, "221 bye"); break; }
                        else send(out, "250 ok");
                    }
                } catch (IOException ignored) {
                    // the test asserts on what was recorded
                }
            });
            thread.start();
        }

        private static void send(OutputStream out, String reply) throws IOException {
            out.write((reply + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
            out.flush();
        }

        Mail mail() {
            return new Mail(true, "127.0.0.1", server.getLocalPort(), "ATS <ats@example.org>", "", "", false, java.util.List.of());
        }

        @Override
        public void close() throws Exception {
            thread.join(3000);
            server.close();
        }
    }

    @Test
    void sendsAMessageAndReadsMultiLineReplies() throws Exception {
        try (Fake f = new Fake(250)) {
            new SmtpSender().send(f.mail(), "sara@example.org", "Ahmed commented on TKT-7 — مرحبا", "Hello\n\nOpen: http://x/tickets/7\n");
            f.thread.join(3000);
            assertTrue(f.lines.contains("MAIL FROM:<ats@example.org>"), f.lines.toString());
            assertTrue(f.lines.contains("RCPT TO:<sara@example.org>"));
            assertTrue(f.lines.stream().anyMatch(l -> l.startsWith("Subject: =?UTF-8?B?")));
            assertTrue(f.lines.contains("Content-Transfer-Encoding: base64"));
            String b64 = f.lines.get(f.lines.indexOf("") + 1);
            assertTrue(new String(Base64.getMimeDecoder().decode(b64), StandardCharsets.UTF_8).startsWith("Hello"));
            assertTrue(f.lines.contains("QUIT"));
        }
    }

    @Test
    void rejectedMessageIsAnError() throws Exception {
        try (Fake f = new Fake(550)) {
            IOException e = assertThrows(IOException.class, () -> new SmtpSender().send(f.mail(), "sara@example.org", "Hi", "x"));
            assertTrue(e.getMessage().contains("550"), e.getMessage());
        }
    }

    @Test
    void subjectEncodingKeepsWordsShortAndPlainAsciiPlain() {
        assertEquals("TKT-7 moved to Testing", SmtpSender.encodeSubject("TKT-7 moved to Testing"));
        String enc = SmtpSender.encodeSubject("مرحبا ".repeat(30));
        for (String part : enc.split("\r\n ")) assertTrue(part.length() <= 75 && part.startsWith("=?UTF-8?B?"), part);
    }
}
