import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../utils/preferences.dart';
import '../utils/cache_manager.dart';
import '../providers/theme_provider.dart';

// Placeholder screens – replace with real implementations as needed
import 'edit_profile_screen.dart';
import 'change_password_screen.dart';
import 'content_filter_screen.dart';
import 'feed_settings_screen.dart';
import 'support_screen.dart';
import 'app_info_screen.dart';
import 'terms_of_service_screen.dart';
import 'privacy_policy_screen.dart';
import '../utils/app_colors.dart';
import '../widgets/custom_button.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // Preference keys
  static const _keyPushNotifications = 'push_notifications';
  static const _keyTwoFactor = 'two_factor_auth';
  static const _keyDarkMode = 'dark_mode';

  bool _pushNotifications = false;
  bool _twoFactor = false;
  bool _darkMode = false;

  @override
  void initState() {
    super.initState();
    // Load persisted values
    _pushNotifications = Preferences.getBool(_keyPushNotifications);
    _twoFactor = Preferences.getBool(_keyTwoFactor);
    _darkMode = Preferences.getBool(_keyDarkMode);
  }

  void _updatePreference(String key, bool value) async {
    await Preferences.setBool(key, value);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("${key.replaceAll('_', ' ')} ${value ? 'enabled' : 'disabled'}")),
    );
  }

  void _showThemeSelector() {
    showModalBottomSheet(
      context: context,
      builder: (_) {
        final themeProvider = Provider.of<ThemeProvider>(context, listen: false);
        return Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.light_mode),
            title: const Text('Light'),
            onTap: () {
              themeProvider.setThemeMode(ThemeMode.light);
              Preferences.setBool(_keyDarkMode, false);
              Navigator.pop(context);
            },
          ),
          ListTile(
            leading: const Icon(Icons.dark_mode),
            title: const Text('Dark'),
            onTap: () {
              themeProvider.setThemeMode(ThemeMode.dark);
              Preferences.setBool(_keyDarkMode, true);
              Navigator.pop(context);
            },
          ),
          ListTile(
            leading: const Icon(Icons.brightness_auto),
            title: const Text('System'),
            onTap: () {
              themeProvider.setThemeMode(ThemeMode.system);
              Preferences.setBool(_keyDarkMode, false);
              Navigator.pop(context);
            },
          ),
        ]);
      },
    );
  }

  Future<void> _clearCache() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear Cache'),
        content: const Text('Are you sure you want to clear cache?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Clear')),
        ],
      ),
    );
    if (confirm == true) {
      await CacheManager.clearCache();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cache cleared successfully')),
      );
    }
  }

  Future<void> _showDeleteAccountDialog() async {
    final passwordController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.dialogBackground,
        title: Text(
          'Delete Account',
          style: GoogleFonts.outfit(color: AppColors.danger, fontWeight: FontWeight.bold),
        ),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'This action is PERMANENT. All your posts, polls, comments, and relationships will be permanently removed.',
                style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: passwordController,
                obscureText: true,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Confirm Password',
                ),
                validator: (val) {
                  if (val == null || val.isEmpty) {
                    return 'Please enter your password to confirm.';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.pop(ctx, true);
              }
            },
            child: const Text('Delete Permanently', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final result = await authProvider.deleteAccount(password: passwordController.text);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Account deleted'),
          backgroundColor: result['success'] == true ? Colors.green : Colors.redAccent,
        ),
      );

      if (result['success'] == true) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    return Scaffold(
      appBar: AppBar(
        title: Text('Settings', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0B0B0F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        children: [
          // Account Section
          _sectionHeader('Account'),
          _listTile(context, Icons.person, 'Edit Profile', () => Navigator.push(context, MaterialPageRoute(builder: (_) => EditProfileScreen()))),
          _listTile(context, Icons.lock, 'Change Password', () => Navigator.push(context, MaterialPageRoute(builder: (_) => ChangePasswordScreen()))),
          _listTile(context, Icons.delete, 'Delete Account', () => _showDeleteAccountDialog()),
          const Divider(height: 1, thickness: 1, color: Color(0xFF2C2C3E)),
          // Appearance Section
          _sectionHeader('Appearance'),
          _listTile(context, Icons.brightness_6, 'Theme', _showThemeSelector, trailing: const Icon(Icons.chevron_right)),
          const Divider(height: 1, thickness: 1, color: Color(0xFF2C2C3E)),
          // Notifications Section
          _sectionHeader('Notifications'),
          _listTile(
            context,
            Icons.notifications,
            'Push Notifications',
            null,
            trailing: Switch(
              value: _pushNotifications,
              onChanged: (val) {
                setState(() => _pushNotifications = val);
                _updatePreference(_keyPushNotifications, val);
              },
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Color(0xFF2C2C3E)),
          // Feed Section
          _sectionHeader('Feed'),
          _listTile(context, Icons.filter_alt, 'Content Filter', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ContentFilterScreen()))),
          _listTile(context, Icons.settings, 'Feed Settings', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FeedSettingsScreen()))),
          const Divider(height: 1, thickness: 1, color: Color(0xFF2C2C3E)),
          // Security Section
          _sectionHeader('Security'),
          _listTile(
            context,
            Icons.security,
            'Two‑Factor Auth',
            null,
            trailing: Switch(
              value: _twoFactor,
              onChanged: (val) {
                setState(() => _twoFactor = val);
                _updatePreference(_keyTwoFactor, val);
              },
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Color(0xFF2C2C3E)),
          // Storage Section
          _sectionHeader('Storage'),
          _listTile(context, Icons.data_usage, 'Clear Cache', _clearCache),
          const Divider(height: 1, thickness: 1, color: Color(0xFF2C2C3E)),
          // Help Section
          _sectionHeader('Help'),
          _listTile(context, Icons.support_agent, 'Support', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SupportScreen()))),
          _listTile(context, Icons.info_outline, 'App Info', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AppInfoScreen()))),
          const Divider(height: 1, thickness: 1, color: Color(0xFF2C2C3E)),
          // About Section
          _sectionHeader('About'),
          _listTile(context, Icons.article, 'Terms of Service', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TermsOfServiceScreen()))),
          _listTile(context, Icons.description, 'Privacy Policy', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()))),
          const Divider(height: 1, thickness: 1, color: Color(0xFF2C2C3E)),
          // Log Out button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: AppButton(
              text: 'Log Out',
              icon: Icons.logout,
              style: AppButtonStyle.danger,
              height: 50,
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: AppColors.dialogBackground,
                    title: const Text('Confirm Log Out', style: TextStyle(color: Colors.white)),
                    content: const Text('Are you sure you want to log out?', style: TextStyle(color: AppColors.textSecondary)),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary))),
                      TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Log Out', style: TextStyle(color: AppColors.danger))),
                    ],
                  ),
                );
                if (confirm == true) {
                  await authProvider.logout();
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Logged out successfully')));
                  Navigator.of(context).popUntil((route) => route.isFirst);
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(title, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primaryLight)),
    );
  }

  Widget _listTile(BuildContext context, IconData icon, String title, VoidCallback? onTap, {Widget? trailing}) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary),
      title: Text(title, style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 15)),
      trailing: trailing,
      onTap: onTap,
    );
  }
}
