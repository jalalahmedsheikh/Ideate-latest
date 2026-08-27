import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'navigation_home.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../utils/app_colors.dart';
import '../widgets/custom_button.dart';

class AuthScreen extends StatefulWidget {
  final int initialTab;

  const AuthScreen({
    super.key,
    this.initialTab = 0,
  });

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

  // Username live availability checking state
  Timer? _debounceTimer;
  bool _isCheckingUsername = false;
  bool? _isUsernameAvailable;
  String _usernameStatusMsg = '';

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
    final tabIndex = (widget.initialTab >= 0 && widget.initialTab < 2) ? widget.initialTab : 0;
    _tabController = TabController(length: 2, vsync: this, initialIndex: tabIndex);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _tabController.dispose();
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _registerUsernameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    super.dispose();
  }

  // Handle Username Input Changes with 500ms Debounce
  void _onUsernameChanged(String val) {
    if (_debounceTimer?.isActive ?? false) _debounceTimer!.cancel();

    final username = val.trim();
    if (username.isEmpty) {
      setState(() {
        _isCheckingUsername = false;
        _isUsernameAvailable = null;
        _usernameStatusMsg = '';
      });
      return;
    }

    if (username.length < 3) {
      setState(() {
        _isCheckingUsername = false;
        _isUsernameAvailable = false;
        _usernameStatusMsg = 'Username must be at least 3 characters.';
      });
      return;
    }

    setState(() {
      _isCheckingUsername = true;
      _isUsernameAvailable = null;
      _usernameStatusMsg = 'Checking availability...';
    });

    _debounceTimer = Timer(const Duration(milliseconds: 500), () async {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final res = await authProvider.checkUsername(username);

      if (mounted) {
        setState(() {
          _isCheckingUsername = false;
          _isUsernameAvailable = res['available'] == true;
          _usernameStatusMsg = res['message'] ?? '';
        });
      }
    });
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
      if (result['success']) {
        if (Navigator.of(context).canPop()) {
          Navigator.of(context).pop(true);
        } else {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const NavigationHome()),
          );
        }
      }
    }
  }

  Future<void> _handleGoogleLogin() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final result = await authProvider.signInWithGoogle();
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result['message'] ?? (result['success'] ? 'Logged in with Google!' : 'Google sign in failed.')),
        backgroundColor: result['success'] ? Colors.green : Colors.red,
      ),
    );

    if (result['success'] == true) {
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const NavigationHome()),
        );
      }
    }
  }

  Future<void> _handleFacebookLogin() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final result = await authProvider.signInWithFacebook();
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result['message'] ?? (result['success'] ? 'Logged in with Facebook!' : 'Facebook sign in failed.')),
        backgroundColor: result['success'] ? Colors.green : Colors.red,
      ),
    );

    if (result['success'] == true) {
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const NavigationHome()),
        );
      }
    }
  }

  // Initiate Registration Flow (Checks Username & Triggers OTP Email)
  Future<void> _handleRegisterInitiate() async {
    if (!_registerFormKey.currentState!.validate()) return;

    if (_isUsernameAvailable == false) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_usernameStatusMsg.isNotEmpty ? _usernameStatusMsg : 'Please choose an available username.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    // Send OTP verification code
    final otpResult = await authProvider.sendOtp(
      _registerEmailController.text.trim(),
      _registerUsernameController.text.trim(),
    );

    if (mounted) {
      if (otpResult['success']) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(otpResult['message']),
            backgroundColor: Colors.green,
          ),
        );
        // Show OTP Modal Dialog
        _showOtpVerificationDialog();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(otpResult['message']),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  // Display OTP Verification Dialog
  void _showOtpVerificationDialog() {
    final List<TextEditingController> otpControllers = List.generate(6, (_) => TextEditingController());
    final List<FocusNode> focusNodes = List.generate(6, (_) => FocusNode());
    int resendSeconds = 60;
    Timer? timer;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2C),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (BuildContext modalContext) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            timer ??= Timer.periodic(const Duration(seconds: 1), (t) {
              if (resendSeconds > 0) {
                setModalState(() {
                  resendSeconds--;
                });
              } else {
                t.cancel();
              }
            });

            Future<void> submitOtp() async {
              final otpCode = otpControllers.map((c) => c.text).join().trim();
              if (otpCode.length < 6) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Please enter all 6 digits of the verification code.'),
                    backgroundColor: Colors.red,
                  ),
                );
                return;
              }

              final authProvider = Provider.of<AuthProvider>(context, listen: false);
              final result = await authProvider.register(
                _registerUsernameController.text.trim(),
                _registerEmailController.text.trim(),
                _registerPasswordController.text,
                _selectedCategory,
                otp: otpCode,
              );

              if (mounted) {
                if (result['success']) {
                  timer?.cancel();
                  Navigator.of(modalContext).pop(); // Close modal sheet
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(result['message']),
                      backgroundColor: Colors.green,
                    ),
                  );
                  // Automatically switch to login tab
                  _tabController.animateTo(0);
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(result['message']),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 24,
                right: 24,
                top: 24,
                bottom: MediaQuery.of(context).viewInsets.bottom + 32,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[700],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Icon(Icons.mark_email_read_outlined, size: 48, color: Color(0xFF7828B4)),
                  const SizedBox(height: 12),
                  Text(
                    'Verify Email Address',
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'We sent a 6-digit verification code to:\n${_registerEmailController.text.trim()}',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF8D8D99)),
                  ),
                  const SizedBox(height: 24),

                  // 6 Digit PIN Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: List.generate(6, (index) {
                      return SizedBox(
                        width: 44,
                        height: 54,
                        child: TextField(
                          controller: otpControllers[index],
                          focusNode: focusNodes[index],
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          maxLength: 1,
                          style: GoogleFonts.outfit(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          decoration: InputDecoration(
                            counterText: '',
                            filled: true,
                            fillColor: const Color(0xFF13131A),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: Color(0xFF33334d)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: Color(0xFF7828B4), width: 2),
                            ),
                          ),
                          onChanged: (val) {
                            if (val.isNotEmpty && index < 5) {
                              focusNodes[index + 1].requestFocus();
                            } else if (val.isEmpty && index > 0) {
                              focusNodes[index - 1].requestFocus();
                            }
                            if (otpControllers.every((c) => c.text.isNotEmpty)) {
                              submitOtp();
                            }
                          },
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 24),

                  // Verify Button
                  Consumer<AuthProvider>(
                    builder: (context, auth, _) {
                      return auth.isLoading
                          ? const CircularProgressIndicator(color: Color(0xFF7828B4))
                          : ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF7828B4),
                                foregroundColor: Colors.white,
                                minimumSize: const Size(double.infinity, 50),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              onPressed: submitOtp,
                              child: Text(
                                'Verify & Create Account',
                                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                            );
                    },
                  ),
                  const SizedBox(height: 16),

                  // Resend Timer Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        "Didn't receive code? ",
                        style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF8D8D99)),
                      ),
                      resendSeconds > 0
                          ? Text(
                              'Resend in ${resendSeconds}s',
                              style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF7828B4), fontWeight: FontWeight.bold),
                            )
                          : TextButton(
                              onPressed: () async {
                                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                                await authProvider.sendOtp(
                                  _registerEmailController.text.trim(),
                                  _registerUsernameController.text.trim(),
                                );
                                setModalState(() {
                                  resendSeconds = 60;
                                });
                                timer = Timer.periodic(const Duration(seconds: 1), (t) {
                                  if (resendSeconds > 0) {
                                    setModalState(() {
                                      resendSeconds--;
                                    });
                                  } else {
                                    t.cancel();
                                  }
                                });
                              },
                              child: Text(
                                'Resend Code',
                                style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF7828B4), fontWeight: FontWeight.bold),
                              ),
                            ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    ).then((_) {
      timer?.cancel();
    });
  }

  Widget _buildSocialButtons(AuthProvider authProvider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 20),
        Row(
          children: [
            const Expanded(child: Divider(color: AppColors.border, thickness: 1)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(
                'OR CONTINUE WITH',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textMuted,
                  letterSpacing: 1.0,
                ),
              ),
            ),
            const Expanded(child: Divider(color: AppColors.border, thickness: 1)),
          ],
        ),
        const SizedBox(height: 16),
        // Google Button
        InkWell(
          onTap: authProvider.isLoading ? null : _handleGoogleLogin,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 50,
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    'G',
                    style: GoogleFonts.poppins(
                      color: const Color(0xFF4285F4),
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  'Continue with Google',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        // Facebook Button
        InkWell(
          onTap: authProvider.isLoading ? null : _handleFacebookLogin,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 50,
            decoration: BoxDecoration(
              color: const Color(0xFF1877F2).withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF1877F2).withOpacity(0.4)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.facebook, color: Color(0xFF1877F2), size: 24),
                const SizedBox(width: 12),
                Text(
                  'Continue with Facebook',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
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
                    if (Navigator.of(context).canPop()) ...[
                      Align(
                        alignment: Alignment.centerLeft,
                        child: IconButton(
                          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
                          onPressed: () => Navigator.of(context).pop(false),
                          tooltip: 'Back to Guest Browsing',
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
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
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: TabBar(
                        controller: _tabController,
                        indicatorSize: TabBarIndicatorSize.tab,
                        indicator: BoxDecoration(
                          gradient: AppColors.buttonGradient,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.3),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        dividerColor: Colors.transparent,
                        labelColor: Colors.white,
                        unselectedLabelColor: AppColors.textMuted,
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
                      height: 600,
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          // Login Form Tab
                          SingleChildScrollView(
                            physics: const BouncingScrollPhysics(),
                            child: Form(
                              key: _loginFormKey,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  TextFormField(
                                    controller: _loginEmailController,
                                    decoration: const InputDecoration(
                                      labelText: 'Email Address',
                                      prefixIcon: Icon(Icons.email_outlined, color: AppColors.textMuted),
                                    ),
                                    validator: (v) => (v == null || v.isEmpty) ? 'Please enter your email' : null,
                                  ),
                                  const SizedBox(height: 16),
                                  TextFormField(
                                    controller: _loginPasswordController,
                                    obscureText: true,
                                    decoration: const InputDecoration(
                                      labelText: 'Password',
                                      prefixIcon: Icon(Icons.lock_outline, color: AppColors.textMuted),
                                    ),
                                    validator: (v) => (v == null || v.isEmpty) ? 'Please enter password' : null,
                                  ),
                                  const SizedBox(height: 24),
                                  AppButton(
                                    text: 'Sign In',
                                    style: AppButtonStyle.gradient,
                                    isLoading: authProvider.isLoading,
                                    onPressed: _handleLogin,
                                    height: 52,
                                  ),
                                  _buildSocialButtons(authProvider),
                                ],
                              ),
                            ),
                          ),

                          // Signup Form Tab with Realtime Username Availability
                          SingleChildScrollView(
                            physics: const BouncingScrollPhysics(),
                            child: Form(
                              key: _registerFormKey,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  // Username Field with Live Indicator
                                  TextFormField(
                                    controller: _registerUsernameController,
                                    onChanged: _onUsernameChanged,
                                    decoration: InputDecoration(
                                      labelText: 'Username',
                                      prefixIcon: const Icon(Icons.person_outline, color: Colors.grey),
                                      suffixIcon: _isCheckingUsername
                                          ? const Padding(
                                              padding: EdgeInsets.all(12.0),
                                              child: SizedBox(
                                                width: 18,
                                                height: 18,
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  color: Color(0xFF7828B4),
                                                ),
                                              ),
                                            )
                                          : _isUsernameAvailable == true
                                              ? const Icon(Icons.check_circle, color: Colors.green)
                                              : _isUsernameAvailable == false
                                                  ? const Icon(Icons.cancel, color: Colors.red)
                                                  : null,
                                    ),
                                    validator: (v) {
                                      if (v == null || v.trim().isEmpty) return 'Please enter username';
                                      if (v.trim().length < 3) return 'Username must be 3+ characters';
                                      if (_isUsernameAvailable == false) return 'Username is already taken';
                                      return null;
                                    },
                                  ),
                                  if (_usernameStatusMsg.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4, left: 12),
                                      child: Text(
                                        _usernameStatusMsg,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: _isUsernameAvailable == true ? Colors.green : Colors.redAccent,
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: 12),
                                  TextFormField(
                                    controller: _registerEmailController,
                                    keyboardType: TextInputType.emailAddress,
                                    decoration: const InputDecoration(
                                      labelText: 'Email Address',
                                      prefixIcon: Icon(Icons.email_outlined, color: Colors.grey),
                                    ),
                                    validator: (v) {
                                      if (v == null || v.trim().isEmpty) return 'Please enter email';
                                      if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(v.trim())) {
                                        return 'Please enter a valid email address';
                                      }
                                      return null;
                                    },
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
                                  const SizedBox(height: 20),
                                  AppButton(
                                    text: 'Verify Email & Register',
                                    style: AppButtonStyle.gradient,
                                    isLoading: authProvider.isLoading,
                                    onPressed: _handleRegisterInitiate,
                                    height: 52,
                                  ),
                                  _buildSocialButtons(authProvider),
                                ],
                              ),
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
