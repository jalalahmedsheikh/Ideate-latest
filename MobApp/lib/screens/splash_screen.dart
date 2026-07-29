import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'navigation_home.dart';
import 'auth_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  // ── Constants ────────────────────────────────────────────────
  static const String _appVersion = '1.0.0';
  static const int _dotCount = 5;
  static const Duration _dotCycleDuration = Duration(milliseconds: 300);
  static const Duration _fadeDuration = Duration(milliseconds: 600);

  // ── Gradient colours ─────────────────────────────────────────
  static const Color _gradientStart = Color(0xFF8B5CF6); // Purple
  static const Color _gradientEnd   = Color(0xFF60A5FA); // Blue

  // ── State ────────────────────────────────────────────────────
  int   _activeDot = 0;
  Timer? _dotTimer;

  // ── Lifecycle ────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _startDotAnimation();
    // Run initialization after first frame so context is ready
    WidgetsBinding.instance.addPostFrameCallback((_) => _initialize());
  }

  @override
  void dispose() {
    _dotTimer?.cancel();
    super.dispose();
  }

  // ── Dot animation ─────────────────────────────────────────────
  void _startDotAnimation() {
    _dotTimer = Timer.periodic(_dotCycleDuration, (_) {
      if (mounted) {
        setState(() => _activeDot = (_activeDot + 1) % _dotCount);
      }
    });
  }

  // ── Initialization ────────────────────────────────────────────
  Future<void> _initialize() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);

    // Run all init tasks in parallel — no artificial delay
    await Future.wait([
      auth.loadPersistedAuth(),       // auth token + user profile
      _loadAppSettings(),             // app preferences / config
    ]);

    if (mounted) _navigate(auth.isAuthenticated);
  }

  /// Placeholder for any extra init tasks (settings, cache warm-up, etc.)
  Future<void> _loadAppSettings() async {
    // Add future init tasks here (e.g. SharedPreferences, remote config)
    await Future.delayed(Duration.zero);
  }

  // ── Navigation (fade, remove splash from stack) ───────────────
  void _navigate(bool authenticated) {
    _dotTimer?.cancel();
    final destination =
        authenticated ? const NavigationHome() : const AuthScreen();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => destination,
        transitionsBuilder: (_, animation, __, child) => FadeTransition(
          opacity: CurvedAnimation(
            parent: animation,
            curve: Curves.easeOut,
          ),
          child: child,
        ),
        transitionDuration: _fadeDuration,
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    // Force full-screen immersive status bar
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.black,
    ));

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // ── Subtle vignette at corners ────────────────────────
          _Vignette(),

          // ── Main content: logo + dots ─────────────────────────
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo image
                Image.asset(
                  'assets/logo/logo.png',
                  width: size.width * 0.68,
                  fit: BoxFit.contain,
                ),

                const SizedBox(height: 56),

                // 5 blinking dots
                _DotsRow(activeDot: _activeDot),
              ],
            ),
          ),

          // ── Version label pinned to bottom ────────────────────
          Positioned(
            bottom: 36 + MediaQuery.of(context).padding.bottom,
            left: 0,
            right: 0,
            child: Text(
              'VERSION $_appVersion',
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 11,
                color: Colors.white,
                fontWeight: FontWeight.w300,
                letterSpacing: 3.0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 SEQUENTIAL PULSE DOTS
// ─────────────────────────────────────────────────────────────────────────────
class _DotsRow extends StatelessWidget {
  const _DotsRow({required this.activeDot});
  final int activeDot;

  static const Color _gradientStart = Color(0xFF8B5CF6);
  static const Color _gradientEnd   = Color(0xFF60A5FA);

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: List.generate(5, (i) {
        final isActive = i == activeDot;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.symmetric(horizontal: 7),
          width:  isActive ? 14.0 : 9.0,
          height: isActive ? 14.0 : 9.0,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end:   Alignment.bottomRight,
              colors: [
                _gradientStart.withOpacity(isActive ? 1.0 : 0.28),
                _gradientEnd.withOpacity(isActive   ? 1.0 : 0.28),
              ],
            ),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: _gradientStart.withOpacity(0.65),
                      blurRadius: 14,
                      spreadRadius: 3,
                    ),
                    BoxShadow(
                      color: _gradientEnd.withOpacity(0.35),
                      blurRadius: 20,
                      spreadRadius: 1,
                    ),
                  ]
                : null,
          ),
        );
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORNER VIGNETTE (subtle dark purple at edges)
// ─────────────────────────────────────────────────────────────────────────────
class _Vignette extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment.center,
              radius: 1.2,
              colors: [
                Colors.transparent,
                const Color(0xFF0D0010).withOpacity(0.6),
              ],
              stops: const [0.55, 1.0],
            ),
          ),
        ),
      ),
    );
  }
}
