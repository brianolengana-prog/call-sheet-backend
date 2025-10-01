@echo off
REM Test Runner for Extraction System (Windows)
REM Runs all tests and generates coverage report

echo.
echo 🧪 Running Extraction System Tests
echo ====================================
echo.

REM Run unit tests
echo 📝 Running Unit Tests
echo --------------------
call npm test -- tests/extraction/adaptiveExtractor.test.js

set UNIT_EXIT=%ERRORLEVEL%

echo.
echo 🔗 Running Integration Tests
echo ----------------------------
call npm test -- tests/integration/extraction.integration.test.js

set INTEGRATION_EXIT=%ERRORLEVEL%

echo.
echo ====================================

REM Summary
if %UNIT_EXIT% EQU 0 if %INTEGRATION_EXIT% EQU 0 (
    echo ✅ All tests passed!
    exit /b 0
) else (
    echo ❌ Some tests failed
    if %UNIT_EXIT% NEQ 0 echo    - Unit tests failed
    if %INTEGRATION_EXIT% NEQ 0 echo    - Integration tests failed
    exit /b 1
)

