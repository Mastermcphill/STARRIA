import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../events/events_provider.dart';

class LiveRoomScreen extends ConsumerStatefulWidget {
  final String eventId;
  const LiveRoomScreen({super.key, required this.eventId});

  @override
  ConsumerState<LiveRoomScreen> createState() => _LiveRoomScreenState();
}

class _LiveRoomScreenState extends ConsumerState<LiveRoomScreen> {
  Map<String, dynamic>? _roomData;
  bool _joining = true;
  bool _showGiftPanel = false;
  final List<_ChatBubble> _chat = [];

  @override
  void initState() {
    super.initState();
    _join();
  }

  Future<void> _join() async {
    try {
      final data = await ref.read(liveJoinProvider.notifier).join(widget.eventId);
      if (mounted) setState(() { _roomData = data; _joining = false; });
    } catch (e) {
      if (mounted) setState(() => _joining = false);
    }
  }

  Future<void> _leave() async {
    await ref.read(liveJoinProvider.notifier).leave(widget.eventId);
    if (mounted) context.pop();
  }

  Future<void> _sendGift(String giftType, int coins) async {
    final recipientId = (_roomData?['room'] as Map?)?['starId'] as String? ?? '';
    await ref.read(liveGiftProvider.notifier).send(
      eventId: widget.eventId,
      recipientId: recipientId,
      giftType: giftType,
      coins: coins,
    );
    if (mounted) {
      setState(() {
        _chat.add(_ChatBubble(text: '🎁 You sent a $giftType gift ($coins coins)!', isSelf: true));
        _showGiftPanel = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Video placeholder (real livekit_client integration in Sprint 4)
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter, end: Alignment.bottomCenter,
                colors: [Color(0xFF1A0030), Color(0xFF000000)],
              ),
            ),
            child: _joining
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: Color(0xFFE040FB)),
                        SizedBox(height: 16),
                        Text('Joining room...', style: TextStyle(color: Colors.white70)),
                      ],
                    ),
                  )
                : const Center(
                    child: Icon(Icons.live_tv, size: 80, color: Colors.white12),
                  ),
          ),

          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: _leave,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black45,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.close, color: Colors.white, size: 16),
                          SizedBox(width: 4),
                          Text('Leave', style: TextStyle(color: Colors.white, fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE040FB),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.circle, color: Colors.white, size: 8),
                        SizedBox(width: 4),
                        Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Chat + controls overlay (bottom)
          if (!_joining)
            Positioned(
              bottom: 0, left: 0, right: 0,
              child: Column(
                children: [
                  // Chat
                  SizedBox(
                    height: 200,
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      reverse: true,
                      itemCount: _chat.length,
                      itemBuilder: (ctx, i) {
                        final msg = _chat[_chat.length - 1 - i];
                        return Align(
                          alignment: msg.isSelf ? Alignment.centerRight : Alignment.centerLeft,
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: msg.isSelf
                                  ? const Color(0xFFE040FB).withOpacity(0.3)
                                  : Colors.white12,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Text(msg.text, style: const TextStyle(color: Colors.white, fontSize: 13)),
                          ),
                        );
                      },
                    ),
                  ),
                  // Controls
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter, end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black],
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () {
                              setState(() => _chat.add(const _ChatBubble(text: '❤️', isSelf: true)));
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: Colors.white12,
                                borderRadius: BorderRadius.circular(24),
                              ),
                              child: const Center(child: Text('React ❤️', style: TextStyle(color: Colors.white))),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        GestureDetector(
                          onTap: () => setState(() => _showGiftPanel = !_showGiftPanel),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE040FB),
                              borderRadius: BorderRadius.circular(24),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.card_giftcard, color: Colors.white, size: 18),
                                SizedBox(width: 6),
                                Text('Gift', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Gift panel
                  if (_showGiftPanel) _GiftPanel(onGift: _sendGift),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ChatBubble {
  final String text;
  final bool isSelf;
  const _ChatBubble({required this.text, required this.isSelf});
}

class _GiftPanel extends StatelessWidget {
  final Future<void> Function(String type, int coins) onGift;
  const _GiftPanel({required this.onGift});

  static const _gifts = [
    ('⭐', 'star', 10),
    ('🔥', 'fire', 25),
    ('👑', 'crown', 50),
    ('💎', 'diamond', 100),
    ('🚀', 'rocket', 250),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF1A1A2E),
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: _gifts.map((g) => GestureDetector(
          onTap: () => onGift(g.$2, g.$3),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(g.$1, style: const TextStyle(fontSize: 32)),
              const SizedBox(height: 4),
              Text('${g.$3}c', style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        )).toList(),
      ),
    );
  }
}
