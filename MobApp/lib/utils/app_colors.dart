import 'package:flutter/material.dart';

/// Ideate Brand Color System derived from the official app logo.
/// Features a deep space dark background and electric purple-to-blue gradient accents.
class AppColors {
  // Brand Primary & Accent Colors
  static const Color primary = Color(0xFFA855F7); // Electric Purple
  static const Color primaryLight = Color(0xFFC084FC); // Light Purple
  static const Color primaryDark = Color(0xFF7E22CE); // Deep Purple

  static const Color secondary = Color(0xFF3B82F6); // Vibrant Blue
  static const Color secondaryLight = Color(0xFF60A5FA); // Light Blue
  static const Color secondaryDark = Color(0xFF1D4ED8); // Deep Blue

  static const Color accentCyan = Color(0xFF06B6D4); // Cyan Accent
  static const Color accentPink = Color(0xFFEC4899); // Pink Accent

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFFA855F7), Color(0xFF3B82F6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient logoGradient = LinearGradient(
    colors: [Color(0xFFD036E7), Color(0xFFA855F7), Color(0xFF3B82F6)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const LinearGradient buttonGradient = LinearGradient(
    colors: [Color(0xFFA855F7), Color(0xFF2563EB)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const LinearGradient buttonGradientHover = LinearGradient(
    colors: [Color(0xFFC084FC), Color(0xFF3B82F6)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const LinearGradient glassGradient = LinearGradient(
    colors: [Color(0x22A855F7), Color(0x113B82F6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient dangerGradient = LinearGradient(
    colors: [Color(0xFFF87171), Color(0xFFEF4444)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  // Background & Surface Colors (Dark Aesthetic)
  static const Color background = Color(0xFF0B0B0F); // Space Dark
  static const Color surface = Color(0xFF14141F); // Dark Glass Surface
  static const Color surfaceElevated = Color(0xFF1C1C2B); // Elevated Card Surface
  static const Color cardBackground = Color(0xFF161622); // Post/Poll Card Fill
  static const Color inputBackground = Color(0xFF141420); // Text Field Input Background
  static const Color dialogBackground = Color(0xFF181826); // Alert Dialog Surface

  // Borders & Dividers
  static const Color border = Color(0xFF252538); // Subtle Card Border
  static const Color borderLight = Color(0xFF32324A); // Active Border
  static const Color borderFocused = Color(0xFFA855F7); // Input Focus Border

  // Text Colors
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF94A3B8); // Muted Slate
  static const Color textMuted = Color(0xFF64748B); // Dark Muted Text
  static const Color textDisabled = Color(0xFF475569);

  // Status & Utility Colors
  static const Color danger = Color(0xFFEF4444);
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);
}
