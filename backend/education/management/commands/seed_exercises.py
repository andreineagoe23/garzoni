"""
Management command to seed exercises into the database.
Run with: python manage.py seed_exercises
"""

from django.core.management.base import BaseCommand
from education.models import Exercise


class Command(BaseCommand):
    help = 'Seed exercises into the database'

    def handle(self, *args, **options):
        exercises_data = [
            # Multiple Choice Exercises
            {
                'type': 'multiple-choice',
                'question': 'What is the 50/30/20 budgeting rule?',
                'exercise_data': {
                    'options': [
                        '50% needs, 30% wants, 20% savings',
                        '50% savings, 30% needs, 20% wants',
                        '50% wants, 30% needs, 20% savings',
                        'Equal distribution across all categories'
                    ],
                    'hints': [
                        'The rule prioritizes essential expenses first',
                        'Savings should be at least 20% of income',
                        'The largest portion goes to necessities'
                    ]
                },
                'correct_answer': 0,
                'category': 'Budgeting',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What is compound interest?',
                'exercise_data': {
                    'options': [
                        'Interest earned on both principal and previously earned interest',
                        'Interest calculated only on the original principal',
                        'Interest that compounds daily',
                        'Interest paid at the end of the investment period'
                    ],
                    'hints': [
                        'This type of interest grows your money faster over time',
                        'It involves earning interest on your interest',
                        'The key is reinvesting earnings'
                    ]
                },
                'correct_answer': 0,
                'category': 'Basic Finance',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What does APR stand for?',
                'exercise_data': {
                    'options': [
                        'Annual Percentage Rate',
                        'Average Payment Rate',
                        'Annual Principal Return',
                        'Accrued Payment Ratio'
                    ],
                    'hints': [
                        'It represents the yearly cost of borrowing',
                        'It includes both interest and fees',
                        'It helps compare different loan offers'
                    ]
                },
                'correct_answer': 0,
                'category': 'Basic Finance',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What is diversification in investing?',
                'exercise_data': {
                    'options': [
                        'Spreading investments across different assets to reduce risk',
                        'Investing all money in one high-performing stock',
                        'Buying only government bonds',
                        'Investing only in cryptocurrency'
                    ],
                    'hints': [
                        'The goal is to reduce overall portfolio risk',
                        'It involves not putting all eggs in one basket',
                        'Different asset classes react differently to market conditions'
                    ]
                },
                'correct_answer': 0,
                'category': 'Investing',
                'difficulty': 'intermediate',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What is a bear market?',
                'exercise_data': {
                    'options': [
                        'A market condition where prices are falling',
                        'A market condition where prices are rising',
                        'A market with high volatility',
                        'A market with low trading volume'
                    ],
                    'hints': [
                        'Typically defined as a 20% decline from recent highs',
                        'Investors are generally pessimistic',
                        'The opposite of a bull market'
                    ]
                },
                'correct_answer': 0,
                'category': 'Investing',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What is the primary purpose of an emergency fund?',
                'exercise_data': {
                    'options': [
                        'To cover unexpected expenses without going into debt',
                        'To invest in high-risk opportunities',
                        'To pay for planned vacations',
                        'To cover monthly bills'
                    ],
                    'hints': [
                        'It should cover 3-6 months of expenses',
                        'It provides financial security',
                        'It prevents you from using credit cards for emergencies'
                    ]
                },
                'correct_answer': 0,
                'category': 'Personal Finance',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What is dollar-cost averaging?',
                'exercise_data': {
                    'options': [
                        'Investing a fixed amount regularly regardless of price',
                        'Buying more when prices are high',
                        'Selling when prices drop',
                        'Investing only when the market is up'
                    ],
                    'hints': [
                        'It reduces the impact of market volatility',
                        'You buy more shares when prices are low',
                        'It\'s a long-term investment strategy'
                    ]
                },
                'correct_answer': 0,
                'category': 'Investing',
                'difficulty': 'intermediate',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What is a REIT?',
                'exercise_data': {
                    'options': [
                        'Real Estate Investment Trust',
                        'Real Estate Income Tax',
                        'Real Estate Interest Transfer',
                        'Real Estate Investment Tax'
                    ],
                    'hints': [
                        'It allows investors to own real estate without buying property directly',
                        'They must pay out at least 90% of taxable income as dividends',
                        'They trade on stock exchanges like regular stocks'
                    ]
                },
                'correct_answer': 0,
                'category': 'Real Estate',
                'difficulty': 'intermediate',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What is a blockchain?',
                'exercise_data': {
                    'options': [
                        'A distributed ledger that records transactions across multiple computers',
                        'A type of cryptocurrency',
                        'A digital wallet',
                        'A trading platform'
                    ],
                    'hints': [
                        'It\'s the technology behind Bitcoin',
                        'Transactions are grouped into blocks',
                        'It provides transparency and security'
                    ]
                },
                'correct_answer': 0,
                'category': 'Cryptocurrency',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'multiple-choice',
                'question': 'What is leverage in forex trading?',
                'exercise_data': {
                    'options': [
                        'Using borrowed capital to increase potential returns',
                        'Trading only with your own money',
                        'Holding positions for long periods',
                        'Diversifying across many currency pairs'
                    ],
                    'hints': [
                        'It amplifies both gains and losses',
                        'Common ratios include 50:1 or 100:1',
                        'It requires careful risk management'
                    ]
                },
                'correct_answer': 0,
                'category': 'Forex',
                'difficulty': 'advanced',
                'is_published': True
            },

            # Numeric Exercises
            {
                'type': 'numeric',
                'question': 'If you invest $1,000 at an annual interest rate of 5% compounded annually, how much will you have after 10 years? (Round to nearest dollar)',
                'exercise_data': {
                    'expected_value': 1628.89,
                    'tolerance': 0.05,
                    'unit': 'USD',
                    'placeholder': 'Enter amount',
                    'validation': 'Use the compound interest formula: A = P(1 + r)^t',
                    'period_hint': 'annual',
                    'hints': [
                        'Formula: A = P(1 + r)^t where P=1000, r=0.05, t=10',
                        'Calculate: 1000 × (1.05)^10',
                        'Remember to convert percentage to decimal (5% = 0.05)'
                    ]
                },
                'correct_answer': 1628.89,
                'category': 'Basic Finance',
                'difficulty': 'intermediate',
                'is_published': True
            },
            {
                'type': 'numeric',
                'question': 'You have a monthly income of $5,000. Following the 50/30/20 rule, how much should you allocate to savings?',
                'exercise_data': {
                    'expected_value': 1000,
                    'tolerance': 0.01,
                    'unit': 'USD',
                    'placeholder': 'Enter amount',
                    'validation': '20% of monthly income',
                    'hints': [
                        'The 20/30/50 rule allocates 20% to savings',
                        'Calculate 20% of $5,000',
                        '20% = 0.20 or 1/5'
                    ]
                },
                'correct_answer': 1000,
                'category': 'Budgeting',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'numeric',
                'question': 'If a stock price increases from $50 to $65, what is the percentage gain? (Round to one decimal place)',
                'exercise_data': {
                    'expected_value': 30.0,
                    'tolerance': 0.1,
                    'unit': '%',
                    'placeholder': 'Enter percentage',
                    'validation': 'Percentage change = ((New - Old) / Old) × 100',
                    'hints': [
                        'Formula: ((65 - 50) / 50) × 100',
                        'Calculate: (15 / 50) × 100',
                        'The answer should be a percentage'
                    ]
                },
                'correct_answer': 30.0,
                'category': 'Investing',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'numeric',
                'question': 'You want to save $20,000 in 5 years. If you can earn 4% annual interest, how much do you need to save monthly? (Round to nearest dollar)',
                'exercise_data': {
                    'expected_value': 301.92,
                    'tolerance': 1.0,
                    'unit': 'USD',
                    'placeholder': 'Enter monthly amount',
                    'validation': 'Use future value of annuity formula',
                    'period_hint': 'monthly',
                    'hints': [
                        'Use the formula: PMT = FV × (r/n) / [(1 + r/n)^(n×t) - 1]',
                        'Monthly rate = 4% / 12 = 0.00333',
                        'Number of periods = 5 × 12 = 60 months'
                    ]
                },
                'correct_answer': 301.92,
                'category': 'Personal Finance',
                'difficulty': 'advanced',
                'is_published': True
            },
            {
                'type': 'numeric',
                'question': 'A property costs $300,000. You make a 20% down payment. How much is your mortgage?',
                'exercise_data': {
                    'expected_value': 240000,
                    'tolerance': 0.01,
                    'unit': 'USD',
                    'placeholder': 'Enter amount',
                    'validation': 'Mortgage = Purchase price - Down payment',
                    'hints': [
                        'Down payment = 20% of $300,000 = $60,000',
                        'Mortgage = $300,000 - $60,000',
                        'The mortgage is the amount you borrow'
                    ]
                },
                'correct_answer': 240000,
                'category': 'Real Estate',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'numeric',
                'question': 'If Bitcoin is trading at $40,000 and you buy 0.5 BTC, how much do you pay?',
                'exercise_data': {
                    'expected_value': 20000,
                    'tolerance': 0.01,
                    'unit': 'USD',
                    'placeholder': 'Enter amount',
                    'validation': 'Total cost = Price per BTC × Quantity',
                    'hints': [
                        'Multiply: $40,000 × 0.5',
                        'Half a Bitcoin at $40,000 per BTC',
                        'Simple multiplication'
                    ]
                },
                'correct_answer': 20000,
                'category': 'Cryptocurrency',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'numeric',
                'question': 'You exchange 1,000 USD to EUR at a rate of 0.85. How many EUR do you receive?',
                'exercise_data': {
                    'expected_value': 850,
                    'tolerance': 0.01,
                    'unit': 'EUR',
                    'placeholder': 'Enter amount',
                    'validation': 'EUR = USD × Exchange rate',
                    'hints': [
                        'Multiply: 1,000 × 0.85',
                        'The exchange rate tells you how many EUR per USD',
                        'At 0.85, each USD is worth 0.85 EUR'
                    ]
                },
                'correct_answer': 850,
                'category': 'Forex',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'numeric',
                'question': 'A bond pays 3% annual interest. If you invest $10,000, how much interest will you earn in one year?',
                'exercise_data': {
                    'expected_value': 300,
                    'tolerance': 0.01,
                    'unit': 'USD',
                    'placeholder': 'Enter amount',
                    'validation': 'Interest = Principal × Rate',
                    'hints': [
                        'Calculate: $10,000 × 0.03',
                        '3% = 0.03 as a decimal',
                        'Simple interest calculation for one year'
                    ]
                },
                'correct_answer': 300,
                'category': 'Investing',
                'difficulty': 'beginner',
                'is_published': True
            },

            # Drag and Drop Exercises
            {
                'type': 'drag-and-drop',
                'question': 'Arrange these steps in the correct order for creating a budget:',
                'exercise_data': {
                    'items': [
                        'Track your income and expenses',
                        'Categorize your spending',
                        'Set spending limits for each category',
                        'Review and adjust monthly'
                    ],
                    'hints': [
                        'You need to know your current situation first',
                        'Understanding where money goes helps set limits',
                        'Monitoring helps you stay on track'
                    ]
                },
                'correct_answer': [0, 1, 2, 3],
                'category': 'Budgeting',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'drag-and-drop',
                'question': 'Order these investment types from lowest to highest risk:',
                'exercise_data': {
                    'items': [
                        'Savings account',
                        'Government bonds',
                        'Stock index fund',
                        'Individual stocks',
                        'Cryptocurrency'
                    ],
                    'hints': [
                        'Government-backed options are typically safest',
                        'Diversified funds are less risky than individual picks',
                        'Volatile assets carry the most risk'
                    ]
                },
                'correct_answer': [0, 1, 2, 3, 4],
                'category': 'Investing',
                'difficulty': 'intermediate',
                'is_published': True
            },
            {
                'type': 'drag-and-drop',
                'question': 'Arrange the steps of the home buying process in order:',
                'exercise_data': {
                    'items': [
                        'Get pre-approved for a mortgage',
                        'Find a real estate agent',
                        'Make an offer',
                        'Home inspection',
                        'Close on the property'
                    ],
                    'hints': [
                        'You need financing before you can make offers',
                        'Professional help is valuable',
                        'Due diligence happens before closing'
                    ]
                },
                'correct_answer': [0, 1, 2, 3, 4],
                'category': 'Real Estate',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'drag-and-drop',
                'question': 'Order these financial goals by priority (most urgent first):',
                'exercise_data': {
                    'items': [
                        'Build emergency fund',
                        'Pay off high-interest debt',
                        'Save for retirement',
                        'Invest in stocks',
                        'Save for vacation'
                    ],
                    'hints': [
                        'Financial security comes before growth',
                        'Debt costs more than investment returns',
                        'Long-term goals follow short-term stability'
                    ]
                },
                'correct_answer': [0, 1, 2, 3, 4],
                'category': 'Personal Finance',
                'difficulty': 'intermediate',
                'is_published': True
            },

            # Budget Allocation Exercises
            {
                'type': 'budget-allocation',
                'question': 'Allocate your monthly income of $4,000 according to the 50/30/20 rule. Categories: Needs, Wants, Savings',
                'exercise_data': {
                    'income': 4000,
                    'categories': ['Needs', 'Wants', 'Savings'],
                    'target': {
                        'category': 'Savings',
                        'min': 800
                    },
                    'hints': [
                        '50% goes to Needs = $2,000',
                        '30% goes to Wants = $1,200',
                        '20% goes to Savings = $800'
                    ]
                },
                'correct_answer': {
                    'Needs': 2000,
                    'Wants': 1200,
                    'Savings': 800
                },
                'category': 'Budgeting',
                'difficulty': 'beginner',
                'is_published': True
            },
            {
                'type': 'budget-allocation',
                'question': 'You earn $6,000/month. Allocate funds: Housing (max 30%), Food (15%), Transportation (10%), Entertainment (10%), Savings (at least 20%), and Other expenses.',
                'exercise_data': {
                    'income': 6000,
                    'categories': ['Housing', 'Food', 'Transportation', 'Entertainment', 'Savings', 'Other'],
                    'target': {
                        'category': 'Savings',
                        'min': 1200
                    },
                    'hints': [
                        'Housing: 30% of $6,000 = $1,800',
                        'Food: 15% = $900',
                        'Transportation: 10% = $600',
                        'Entertainment: 10% = $600',
                        'Savings: At least 20% = $1,200',
                        'Other: Remaining amount'
                    ]
                },
                'correct_answer': {
                    'Housing': 1800,
                    'Food': 900,
                    'Transportation': 600,
                    'Entertainment': 600,
                    'Savings': 1200,
                    'Other': 900
                },
                'category': 'Budgeting',
                'difficulty': 'intermediate',
                'is_published': True
            },
            {
                'type': 'budget-allocation',
                'question': 'Allocate $5,000 monthly income: Rent ($1,500), Groceries ($600), Utilities ($200), Insurance ($300), Savings (at least $1,000), and Discretionary spending.',
                'exercise_data': {
                    'income': 5000,
                    'categories': ['Rent', 'Groceries', 'Utilities', 'Insurance', 'Savings', 'Discretionary'],
                    'target': {
                        'category': 'Savings',
                        'min': 1000
                    },
                    'hints': [
                        'Fixed expenses: Rent $1,500 + Utilities $200 + Insurance $300 = $2,000',
                        'Groceries: $600',
                        'Savings: At least $1,000',
                        'Discretionary: Remaining = $1,400'
                    ]
                },
                'correct_answer': {
                    'Rent': 1500,
                    'Groceries': 600,
                    'Utilities': 200,
                    'Insurance': 300,
                    'Savings': 1000,
                    'Discretionary': 1400
                },
                'category': 'Personal Finance',
                'difficulty': 'intermediate',
                'is_published': True
            },
        ]

        created_count = 0
        skipped_count = 0

        for exercise_data in exercises_data:
            # Check if exercise already exists (by question and type)
            existing = Exercise.objects.filter(
                question=exercise_data['question'],
                type=exercise_data['type']
            ).first()

            if existing:
                self.stdout.write(
                    self.style.WARNING(f'Skipping: "{exercise_data["question"][:50]}..." (already exists)')
                )
                skipped_count += 1
                continue

            exercise = Exercise.objects.create(**exercise_data)
            created_count += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f'Created: {exercise.type} - {exercise.category} - {exercise.difficulty}'
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nSummary: Created {created_count} exercises, skipped {skipped_count} existing exercises.'
            )
        )

