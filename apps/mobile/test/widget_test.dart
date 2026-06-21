// Minimal smoke test. The default Flutter counter scaffold was replaced — it
// referenced a nonexistent `package:app/main.dart` / `MyApp`. The real root
// widget is `StarriaApp` (a Riverpod ConsumerWidget that performs startup I/O),
// so a full app pump isn't a good deterministic unit test yet. Add a proper
// StarriaApp smoke/integration test once startup can be stubbed.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders a basic frame', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Center(child: Text('STARRIA'))),
      ),
    );

    expect(find.text('STARRIA'), findsOneWidget);
  });
}
