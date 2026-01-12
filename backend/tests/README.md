# Test Suite Documentation

This directory contains comprehensive tests for all backend apps in the Monevo platform.

## Test Structure

```
tests/
├── __init__.py
├── base.py                    # Base test classes and utilities
├── test_authentication.py    # Authentication app tests
├── test_education.py         # Education app tests
├── test_gamification.py      # Gamification app tests
├── test_finance.py          # Finance app tests
├── test_support.py          # Support app tests
└── README.md                # This file
```

## Running Tests

### Run all tests
```bash
python manage.py test
```

### Run tests for a specific app
```bash
python manage.py test tests.test_authentication
python manage.py test tests.test_education
python manage.py test tests.test_gamification
python manage.py test tests.test_finance
python manage.py test tests.test_support
```

### Run a specific test class
```bash
python manage.py test tests.test_authentication.UserRegistrationTest
```

### Run a specific test method
```bash
python manage.py test tests.test_authentication.UserRegistrationTest.test_register_user_success
```

### Run with verbose output
```bash
python manage.py test --verbosity=2
```

### Run with coverage
```bash
pip install coverage
coverage run --source='.' manage.py test
coverage report
coverage html  # Generate HTML report
```

## Test Coverage

### Authentication App (`test_authentication.py`)
- User registration (success, validation, duplicates)
- User login and token refresh
- User profile management
- Referral system
- Friend requests
- Hearts (lives) system
- Entitlements
- Password management
- User settings

### Education App (`test_education.py`)
- Path CRUD operations
- Course CRUD operations
- Lesson CRUD operations
- Lesson section management (text, video, exercises)
- User progress tracking
- Lesson and section completion
- Exercise submission and validation
- Quiz functionality
- Mastery (spaced repetition) system
- Flow state persistence

### Gamification App (`test_gamification.py`)
- Badge earning and criteria
- Mission completion and progress
- Daily and weekly mission resets
- Mission swapping
- Leaderboard functionality
- Streak items (freeze, boost)
- Recent activity tracking
- Mission performance analytics

### Finance App (`test_finance.py`)
- Simulated savings account
- Finance facts
- Reward purchasing (shop and donations)
- Portfolio management (stocks, crypto)
- Financial goals
- Stripe payment processing
- Savings goal calculator
- Stock/Forex/Crypto price APIs
- Funnel event tracking

### Support App (`test_support.py`)
- FAQ listing and voting
- Contact form submissions
- OpenRouter AI proxy
- Entitlement checking
- Error handling

## Base Test Classes

### `BaseTestCase`
Base test class with common setup:
- Creates test users (regular, admin)
- Creates user profiles
- Creates test path, course, and lesson
- Provides helper methods for authentication

### `AuthenticatedTestCase`
Extends `BaseTestCase` and automatically authenticates the test user.

## Test Best Practices

1. **Isolation**: Each test is independent and doesn't rely on other tests
2. **Cleanup**: Tests clean up after themselves (Django's test framework handles this)
3. **Mocking**: External services (Stripe, OpenRouter) are mocked
4. **Assertions**: Clear, specific assertions for expected behavior
5. **Edge Cases**: Tests cover both success and failure scenarios

## Common Patterns

### Testing API Endpoints
```python
def test_endpoint(self):
    url = reverse("endpoint-name")
    data = {"field": "value"}
    response = self.client.post(url, data, format="json")
    self.assertEqual(response.status_code, status.HTTP_200_OK)
    self.assertIn("expected_field", response.data)
```

### Testing with Authentication
```python
def setUp(self):
    super().setUp()
    self.authenticate_user()  # Or use AuthenticatedTestCase
```

### Testing Admin-Only Endpoints
```python
def setUp(self):
    super().setUp()
    self.authenticate_admin()
```

### Mocking External Services
```python
@patch("module.external_service")
def test_with_mock(self, mock_service):
    mock_service.return_value = Mock(status_code=200)
    # Test code
```

## Continuous Integration

These tests should be run in CI/CD pipelines:
- On every pull request
- Before merging to main
- On scheduled basis

## Troubleshooting

### Tests failing with database errors
- Ensure migrations are up to date: `python manage.py migrate`
- Check that test database is properly configured

### Import errors
- Ensure you're running tests from the backend directory
- Check that all dependencies are installed: `pip install -r requirements.txt`

### Mock-related errors
- Ensure `unittest.mock` is imported correctly
- Check that patch decorators match the actual import paths

## Adding New Tests

When adding new features:
1. Add tests to the appropriate test file
2. Follow existing test patterns
3. Test both success and failure cases
4. Test edge cases and boundary conditions
5. Update this README if adding new test categories

## Test Data

Test data is created in `setUp()` methods and is automatically cleaned up after each test. No manual cleanup is required.

## Notes

- Tests use SQLite by default (configured in test settings)
- External API calls are mocked to avoid rate limits and costs
- Some tests may require specific environment variables (check test code)
- Tests are designed to run quickly and in parallel when possible
