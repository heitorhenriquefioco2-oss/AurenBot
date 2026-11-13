#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
: "${JSON_TEST_JAR:?Informe JSON_TEST_JAR para JSON-java 20240303}"
mkdir -p "$ROOT/build/tests"
SOURCES=("$ROOT/src/com/aurenbot/alertas/HttpReceiver.java" "$ROOT/src/com/aurenbot/alertas/EventPolicy.java" "$ROOT/tests/ProtocolTest.java")
if [[ -n "${ECJ_JAR:-}" ]]; then
 java -jar "$ECJ_JAR" -source 8 -target 8 -nowarn -cp "$JSON_TEST_JAR" -d "$ROOT/build/tests" "${SOURCES[@]}"
else
 javac -source 8 -target 8 -encoding UTF-8 -cp "$JSON_TEST_JAR" -d "$ROOT/build/tests" "${SOURCES[@]}"
fi
java -cp "$ROOT/build/tests:$JSON_TEST_JAR" com.aurenbot.alertas.ProtocolTest
