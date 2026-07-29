import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/auth_provider.dart';
import 'screens/splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        // NOTE: Do NOT call loadPersistedAuth() here —
        // SplashScreen runs initialization in parallel during startup.
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: const IdeateApp(),
    ),
  );
}

class IdeateApp extends StatelessWidget {
  const IdeateApp({super.key});

  @override
  Widget build(BuildContext context) {
    final darkTheme = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF0B0B0F),
      colorScheme: const ColorScheme.dark(
        primary: Color(0xFF7828B4),
        secondary: Color(0xFFFD1D1D),
        surface: Color(0xFF181824),
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: Colors.white,
      ),
      textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme).copyWith(
        titleLarge: GoogleFonts.outfit(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
        bodyLarge: GoogleFonts.inter(
          fontSize: 16,
          color: const Color(0xFFE1E1E6),
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: 14,
          color: const Color(0xFFC4C4CC),
        ),
      ),
      cardTheme: CardTheme(
        color: const Color(0xFF181824),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF2C2C3E), width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFF1E1E2C),
        labelStyle: GoogleFonts.inter(color: const Color(0xFF8D8D99)),
        hintStyle: GoogleFonts.inter(color: const Color(0xFF6E6E77)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF7828B4), width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFFD1D1D), width: 1),
        ),
      ),
    );

    return MaterialApp(
      title: 'Ideate',
      debugShowCheckedModeBanner: false,
      theme: darkTheme,
      // SplashScreen is now the entry point — it handles all init + navigation
      home: const SplashScreen(),
    );
  }
}
