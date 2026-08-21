// lib/screens/app_info_screen.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';

class AppInfoScreen extends StatelessWidget {
  const AppInfoScreen({super.key});

  Future<Map<String, String>> _loadInfo() async {
    final info = await PackageInfo.fromPlatform();
    return {
      'appName': info.appName,
      'packageName': info.packageName,
      'version': info.version,
      'buildNumber': info.buildNumber,
      'author': 'JALAL AHMED SHEIKH',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('App Info', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0B0B0F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: FutureBuilder<Map<String, String>>(
        future: _loadInfo(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final data = snapshot.data!;
          return Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('App Name: ${data['appName']}', style: GoogleFonts.inter(fontSize: 16)),
                Text('Package: ${data['packageName']}', style: GoogleFonts.inter(fontSize: 16)),
                Text('Version: ${data['version']}', style: GoogleFonts.inter(fontSize: 16)),
                Text('Build: ${data['buildNumber']}', style: GoogleFonts.inter(fontSize: 16)),
                const SizedBox(height: 12),
                Text('Author: ${data['author']}', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                const Text('This app is built with Flutter and follows a premium design aesthetic.', style: TextStyle(fontSize: 14)),
              ],
            ),
          );
        },
      ),
    );
  }
}
