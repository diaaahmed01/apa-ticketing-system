package com.apa.ats.common;

import java.security.SecureRandom;

public final class Passwords {

    // No 0/O, 1/l/I: temporary passwords are read aloud and typed by hand.
    private static final String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Passwords() {}

    public static String temporary() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 14; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        // guarantee at least one digit and one letter
        sb.setCharAt(RANDOM.nextInt(7), (char) ('2' + RANDOM.nextInt(8)));
        sb.setCharAt(7 + RANDOM.nextInt(7), (char) ('a' + RANDOM.nextInt(8)));
        return sb.toString();
    }

    /** Minimum policy for user-chosen passwords. Returns an error message, or null when acceptable. */
    public static String policyViolation(String password, String username) {
        if (password == null || password.length() < 10) return "Use at least 10 characters.";
        if (password.length() > 128) return "Use at most 128 characters.";
        if (password.chars().noneMatch(Character::isLetter) || password.chars().noneMatch(Character::isDigit)) {
            return "Use both letters and numbers.";
        }
        if (username != null && password.toLowerCase().contains(username.toLowerCase())) {
            return "The password must not contain your username.";
        }
        return null;
    }
}
