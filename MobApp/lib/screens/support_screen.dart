// lib/screens/support_screen.dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:google_fonts/google_fonts.dart';

import '../utils/app_colors.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  static const String _supportEmail = 'jalalahmadsheikh@gmail.com';
  static const String _webFormUrl = 'https://example.com/support-form'; // replace with actual URL if available

  Future<void> _launchEmail() async {
    final uri = Uri(scheme: 'mailto', path: _supportEmail);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _launchWebForm() async {
    final uri = Uri.parse(_webFormUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Support', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.email, color: AppColors.primary),
            title: Text('Email Support', style: GoogleFonts.inter(color: AppColors.textPrimary)),
            subtitle: Text(_supportEmail, style: GoogleFonts.inter(color: AppColors.textSecondary)),
            onTap: _launchEmail,
          ),
          ListTile(
            leading: const Icon(Icons.web, color: AppColors.primary),
            title: Text('Web Form', style: GoogleFonts.inter(color: AppColors.textPrimary)),
            subtitle: Text('Open support web form', style: GoogleFonts.inter(color: AppColors.textSecondary)),
            onTap: _launchWebForm,
          ),
        ],
      ),
    );
  }
}

