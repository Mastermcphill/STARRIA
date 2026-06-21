import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'events_provider.dart';

class TicketPurchaseScreen extends ConsumerStatefulWidget {
  final String eventId;
  const TicketPurchaseScreen({super.key, required this.eventId});

  @override
  ConsumerState<TicketPurchaseScreen> createState() => _TicketPurchaseScreenState();
}

class _TicketPurchaseScreenState extends ConsumerState<TicketPurchaseScreen> {
  int _quantity = 1;
  bool _purchasing = false;
  String? _error;
  Map<String, dynamic>? _success;

  // Hardcoded for now — Sprint 4 will load from /events/:id/tickets
  static const _mockTicketId = 'standard-ticket-001';
  static const _mockStarId   = 'placeholder-star-id';
  static const _coinCost     = 100;

  Future<void> _purchase() async {
    setState(() { _purchasing = true; _error = null; });
    try {
      final result = await ref.read(ticketPurchaseProvider.notifier).purchase(
        eventId: widget.eventId,
        ticketId: _mockTicketId,
        starId: _mockStarId,
        quantity: _quantity,
      );
      setState(() { _success = result; _purchasing = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _purchasing = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Buy Ticket', style: TextStyle(color: Colors.white)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: _success != null
            ? _SuccessView(onDone: () => context.go('/tickets/me'))
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Standard Ticket',
                      style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('${_coinCost * _quantity} coins',
                      style: const TextStyle(color: Color(0xFFE040FB), fontSize: 18, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 32),
                  // Quantity selector
                  Row(
                    children: [
                      const Text('Quantity', style: TextStyle(color: Colors.white70, fontSize: 16)),
                      const Spacer(),
                      _CounterButton(icon: Icons.remove, onTap: () {
                        if (_quantity > 1) setState(() => _quantity--);
                      }),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text('$_quantity',
                            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                      ),
                      _CounterButton(icon: Icons.add, onTap: () {
                        if (_quantity < 10) setState(() => _quantity++);
                      }),
                    ],
                  ),
                  const SizedBox(height: 32),
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.redAccent),
                      ),
                      child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                    ),
                    const SizedBox(height: 16),
                  ],
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _purchasing ? null : _purchase,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE040FB),
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: _purchasing
                          ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                          : Text('Pay ${_coinCost * _quantity} Coins',
                              style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _CounterButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _CounterButton({required this.icon, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A2E),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.white24),
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
      );
}

class _SuccessView extends StatelessWidget {
  final VoidCallback onDone;
  const _SuccessView({required this.onDone});
  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle_outline, size: 80, color: Color(0xFF00BFA5)),
            const SizedBox(height: 24),
            const Text('Ticket Purchased!',
                style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            const Text('Your ticket is confirmed. See you at the event!',
                style: TextStyle(color: Colors.white60), textAlign: TextAlign.center),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: onDone,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE040FB),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              ),
              child: const Text('View My Tickets', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
}
