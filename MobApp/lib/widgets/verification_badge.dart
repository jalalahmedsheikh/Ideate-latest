import 'package:flutter/material.dart';

class VerificationBadge extends StatelessWidget {
  final String? category; // 'identity', 'organization', 'creator', 'notable'
  final double size;

  const VerificationBadge({
    Key? key,
    this.category,
    this.size = 16.0,
  }) : super(key: key);

  Color _getBadgeColor() {
    switch (category?.toLowerCase()) {
      case 'organization':
        return const Color(0xFFE5A93B); // Gold check for organizations
      case 'creator':
        return const Color(0xFF8E24AA); // Purple check for verified creators
      case 'notable':
        return const Color(0xFF00ACC1); // Teal check for notable figures
      case 'identity':
      default:
        return const Color(0xFF1DA1F2); // Sky blue check
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getBadgeColor();
    return Tooltip(
      message: 'Verified ${category != null ? "($category)" : ""}',
      child: Container(
        margin: const EdgeInsets.only(left: 4),
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
        ),
        child: Center(
          child: Icon(
            Icons.check,
            color: Colors.white,
            size: size * 0.75,
          ),
        ),
      ),
    );
  }
}
