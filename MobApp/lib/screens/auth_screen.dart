import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _loginFormKey = GlobalKey<FormState>();
  final _registerFormKey = GlobalKey<FormState>();

  // Login controllers
  final _loginEmailController = TextEditingController();
  final _loginPasswordController = TextEditingController();

  // Register controllers
  final _registerUsernameController = TextEditingController();
  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();
  String _selectedCategory = 'Ideate-User';

  final List<String> _categories = [
    'Ideate-User',
    'Mern Stack Developer',
    'sport',
    'politician',
    'actor',
    'musician',
    'entrepreneur',
    'artist',
    'creator',
    'Developer',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _registerUsernameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_loginFormKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final result = await authProvider.login(
      _loginEmailController.text.trim(),
      _loginPasswordController.text,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message']),
          backgroundColor: result['success'] ? Colors.green : Colors.red,
        ),
      );
    }
  }

  Future<void> _handleRegister() async {
    if (!_registerFormKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final result = await authProvider.register(
      _registerUsernameController.text.trim(),
      _registerEmailController.text.trim(),
      _registerPasswordController.text,
      _selectedCategory,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message']),
          backgroundColor: result['success'] ? Colors.green : Colors.red,
        ),
      );
      if (result['success']) {
        // Automatically switch to login tab
        _tabController.animateTo(0);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 32,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand Logo / Title
                    Center(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.asset(
                          'assets/logo/logo.png',
                          height: 80,
                          width: 80,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Ideate',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 48,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Share ideas, validate queries & interact.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: const Color(0xFF8D8D99),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Tab buttons
                    Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E1E2C),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: TabBar(
                        controller: _tabController,
                        indicatorSize: TabBarIndicatorSize.tab,
                        indicator: BoxDecoration(
                          color: const Color(0xFF7828B4),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        dividerColor: Colors.transparent,
                        labelColor: Colors.white,
                        unselectedLabelColor: const Color(0xFF8D8D99),
                        labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold),
                        tabs: const [
                          Tab(text: 'Login'),
                          Tab(text: 'Sign Up'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Tab View area
                    SizedBox(
                      height: 400,
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          // Login Form
                          Form(
                            key: _loginFormKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                TextFormField(
                                  controller: _loginEmailController,
                                  decoration: const InputDecoration(
                                    labelText: 'Email Address',
                                    prefixIcon: Icon(Icons.email_outlined, color: Colors.grey),
                                  ),
                                  validator: (v) => (v == null || v.isEmpty) ? 'Please enter your email' : null,
                                ),
                                const SizedBox(height: 16),
                                TextFormField(
                                  controller: _loginPasswordController,
                                  obscureText: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Password',
                                    prefixIcon: Icon(Icons.lock_outline, color: Colors.grey),
                                  ),
                                  validator: (v) => (v == null || v.isEmpty) ? 'Please enter password' : null,
                                ),
                                const SizedBox(height: 32),
                                authProvider.isLoading
                                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF7828B4)))
                                    : ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF7828B4),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(vertical: 16),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                        ),
                                        onPressed: _handleLogin,
                                        child: Text(
                                          'Sign In',
                                          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                              ],
                            ),
                          ),

                          // Signup Form
                          Form(
                            key: _registerFormKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                TextFormField(
                                  controller: _registerUsernameController,
                                  decoration: const InputDecoration(
                                    labelText: 'Username',
                                    prefixIcon: Icon(Icons.person_outline, color: Colors.grey),
                                  ),
                                  validator: (v) => (v == null || v.isEmpty) ? 'Please enter username' : null,
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _registerEmailController,
                                  decoration: const InputDecoration(
                                    labelText: 'Email Address',
                                    prefixIcon: Icon(Icons.email_outlined, color: Colors.grey),
                                  ),
                                  validator: (v) => (v == null || v.isEmpty) ? 'Please enter email' : null,
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _registerPasswordController,
                                  obscureText: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Password',
                                    prefixIcon: Icon(Icons.lock_outline, color: Colors.grey),
                                  ),
                                  validator: (v) => (v == null || v.length < 6) ? 'Password must be 6+ chars' : null,
                                ),
                                const SizedBox(height: 12),
                                DropdownButtonFormField<String>(
                                  value: _selectedCategory,
                                  decoration: const InputDecoration(
                                    labelText: 'Profession / Category',
                                    prefixIcon: Icon(Icons.work_outline, color: Colors.grey),
                                  ),
                                  items: _categories.map((cat) {
                                    return DropdownMenuItem(
                                      value: cat,
                                      child: Text(cat),
                                    );
                                  }).toList(),
                                  onChanged: (v) {
                                    if (v != null) {
                                      setState(() {
                                        _selectedCategory = v;
                                      });
                                    }
                                  },
                                ),
                                const SizedBox(height: 24),
                                authProvider.isLoading
                                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF7828B4)))
                                    : ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF7828B4),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(vertical: 16),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                        ),
                                        onPressed: _handleRegister,
                                        child: Text(
                                          'Sign Up',
                                          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
