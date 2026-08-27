import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../screens/auth_screen.dart';
import '../utils/app_colors.dart';
import 'custom_button.dart';

class GuestStateCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final VoidCallback? onAuthSuccess;

  const GuestStateCard({
    super.key,
    required this.title,
    required this.description,
    required this.icon,
    this.onAuthSuccess,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Icon container with gradient circle
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: AppColors.primaryGradient,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.3),
                    blurRadius: 24,
                    spreadRadius: 4,
                  ),
                ],
              ),
              child: Icon(
                icon,
                color: Colors.white,
                size: 38,
              ),
            ),
            const SizedBox(height: 24),

            // Title
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),

            // Description
            Text(
              description,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 32),

            // Log In button
            AppButton(
              text: 'Log In',
              icon: Icons.login_rounded,
              style: AppButtonStyle.gradient,
              height: 50,
              onPressed: () async {
                final authed = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const AuthScreen(initialTab: 0),
                  ),
                );
                if (authed == true && onAuthSuccess != null) {
                  onAuthSuccess!();
                }
              },
            ),
            const SizedBox(height: 14),

            // Sign Up button
            AppButton(
              text: 'Create an Account',
              icon: Icons.person_add_outlined,
              style: AppButtonStyle.outlined,
              height: 50,
              onPressed: () async {
                final authed = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const AuthScreen(initialTab: 1),
                  ),
                );
                if (authed == true && onAuthSuccess != null) {
                  onAuthSuccess!();
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
