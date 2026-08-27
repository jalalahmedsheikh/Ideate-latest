import 'package:flutter/material.dart';

class ReputationChip extends StatelessWidget {
  final int score;
  final String level;
  final bool compact;
  final VoidCallback? onTap;

  const ReputationChip({
    Key? key,
    required this.score,
    this.level = 'Newcomer',
    this.compact = false,
    this.onTap,
  }) : super(key: key);

  Color _getLevelColor(String level) {
    switch (level.toLowerCase()) {
      case 'community leader':
        return const Color(0xFFFF6D00); // Vivid Orange
      case 'expert contributor':
        return const Color(0xFF6200EA); // Deep Purple
      case 'trusted contributor':
        return const Color(0xFF2962FF); // Royal Blue
      case 'contributor':
        return const Color(0xFF00C853); // Fresh Green
      case 'newcomer':
      default:
        return const Color(0xFF78909C); // Slate Grey
    }
  }

  IconData _getLevelIcon(String level) {
    switch (level.toLowerCase()) {
      case 'community leader':
        return Icons.military_tech;
      case 'expert contributor':
        return Icons.auto_awesome;
      case 'trusted contributor':
        return Icons.verified_user;
      case 'contributor':
        return Icons.trending_up;
      case 'newcomer':
      default:
        return Icons.eco;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getLevelColor(level);
    final icon = _getLevelIcon(level);

    if (compact) {
      return Tooltip(
        message: 'Reputation: $score ($level)',
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color.withOpacity(0.3), width: 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 11, color: color),
                const SizedBox(width: 3),
                Text(
                  '$score',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.35), width: 1.2),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
            Text(
              '$score',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              '• $level',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: color.withOpacity(0.85),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
