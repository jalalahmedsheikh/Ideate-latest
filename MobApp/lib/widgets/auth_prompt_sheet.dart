import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../screens/auth_screen.dart';
import '../utils/app_colors.dart';
import 'custom_button.dart';

class AuthPrompt {
  /// Displays a centralized, branded bottom sheet explaining why authentication is needed.
  /// Returns `true` if the user successfully authenticated, `false` or `null` otherwise.
  static Future<bool?> show(
    BuildContext context, {
    required String title,
    required String message,
    IconData icon = Icons.lock_outline_rounded,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _AuthPromptSheet(
        title: title,
        message: message,
        icon: icon,
      ),
    );
  }
}

class _AuthPromptSheet extends StatelessWidget {
  final String title;
  final String message;
  final IconData icon;

  const _AuthPromptSheet({
    required this.title,
    required this.message,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 20,
        bottom: 24 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.6),
            blurRadius: 30,
            spreadRadius: 5,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Drag indicator bar
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.borderLight,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 24),

          // Icon circle with gradient ring
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: AppColors.primaryGradient,
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.35),
                  blurRadius: 18,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Icon(
              icon,
              color: Colors.white,
              size: 30,
            ),
          ),
          const SizedBox(height: 18),

          // Title
          Text(
            title,
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),

          // Message
          Text(
            message,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 28),

          // Log In Button
          AppButton(
            text: 'Log In',
            icon: Icons.login_rounded,
            style: AppButtonStyle.gradient,
            height: 50,
            onPressed: () async {
              Navigator.pop(context); // Close bottom sheet
              final result = await Navigator.push<bool>(
                context,
                MaterialPageRoute(
                  builder: (_) => const AuthScreen(initialTab: 0),
                ),
              );
              // Result handles subsequent action in parent widget
            },
          ),
          const SizedBox(height: 12),

          // Sign Up Button
          AppButton(
            text: 'Sign Up',
            icon: Icons.person_add_outlined,
            style: AppButtonStyle.outlined,
            height: 50,
            onPressed: () async {
              Navigator.pop(context); // Close bottom sheet
              await Navigator.push<bool>(
                context,
                MaterialPageRoute(
                  builder: (_) => const AuthScreen(initialTab: 1),
                ),
              );
            },
          ),
          const SizedBox(height: 12),

          // Dismiss text button
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Continue Browsing as Guest',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
