"""
Replace Quick Check sections that used the generic 'What's one way to use what you
learned in this lesson?' (or similar) with proper text lesson recaps.
Converts content_type from 'exercise' to 'text' and sets text_content. Preserves
section IDs and order so user progress is unchanged.
"""

from django.core.management.base import BaseCommand

from education.models import LessonSection, LessonSectionTranslation

# Section IDs: generic Quick Checks + remaining short-question Quick Checks. We replace with text recaps.
SECTION_IDS = [
    1173,
    1193,
    1198,
    1218,
    1223,
    1243,
    1258,
    1273,
    1288,
    1383,
    1398,
    1413,
    1511,
    1516,
    1521,
    1531,
    1536,
    1546,
    1551,
    1556,
    1566,
    1571,
    1576,
    1586,
    1596,
    1606,
    1621,
    1626,
    1636,
    1646,
    1661,
    1666,
]

# Lesson-specific recap text (plain; can contain simple HTML if needed)
LESSON_RECAPS = {
    1173: (
        "<p><strong>Key takeaway</strong>: A budget is a plan for how you'll spend and save your money. "
        "It helps you stay on track, avoid overspending, and put money toward goals. "
        "Start by listing your income and fixed costs, then allocate the rest to savings and flexible spending.</p>"
    ),
    1193: (
        "<p><strong>Key takeaway</strong>: Tracking income and expenses shows you where your money goes. "
        "Use an app, spreadsheet, or notebook to log earnings and spending. "
        "Review it regularly so you can spot patterns and adjust before you run short.</p>"
    ),
    1198: (
        "<p><strong>Key takeaway</strong>: Credit means borrowing money or buying something now and paying later. "
        "Lenders charge interest and expect repayment on time. Use credit wisely so it helps you without costing too much.</p>"
    ),
    1218: (
        "<p><strong>Key takeaway</strong>: When managing debt, list everything you owe and prioritise by interest rate or balance. "
        "Pay at least the minimum on all accounts; put any extra toward the debt you're targeting first. "
        "Stick to the plan and avoid new debt where you can.</p>"
    ),
    1223: (
        "<p><strong>Key takeaway</strong>: Investing aims to grow your money over time through assets like shares or funds. "
        "It carries risk, so it's important to understand what you're buying and to spread your money across different investments.</p>"
    ),
    1243: (
        "<p><strong>Key takeaway</strong>: A solid investment plan includes your goals, how long you can invest, and how much risk you can accept. "
        "Match your choices to that plan and review it when your life or goals change.</p>"
    ),
    1258: (
        "<p><strong>Key takeaway</strong>: Rental property can provide rental income and potential long-term value growth. "
        "It also involves maintenance, tenant management, and market risk. Weigh the pros and cons before you commit.</p>"
    ),
    1273: (
        "<p><strong>Key takeaway</strong>: Risk management in real estate helps you limit losses and protect your capital. "
        "Use strategies like diversification, insurance, and cash reserves so you can handle vacancies or market downturns.</p>"
    ),
    1288: (
        "<p><strong>Key takeaway</strong>: A real estate syndication is when a group of investors pool money to buy and run a property together. "
        "You get exposure to larger deals and professional management, but you give up some control and liquidity.</p>"
    ),
    1383: (
        "<p><strong>Key takeaway</strong>: When income is irregular, build a buffer from higher-earning periods and plan spending around your lowest expected income. "
        "Keep essential costs and savings in mind so you can ride out lean months without stress.</p>"
    ),
    1398: (
        "<p><strong>Key takeaway</strong>: Needs are essential for living and working; wants are things we'd like but can skip. "
        "Separating them helps you spend on what matters and cut back on the rest without feeling deprived.</p>"
    ),
    1413: (
        "<p><strong>Key takeaway</strong>: A high-yield savings account pays a higher interest rate than a typical savings account. "
        "Use one for your emergency fund or short-term goals so your cash earns a bit more while staying accessible.</p>"
    ),
    # Remaining lessons (short Quick Check questions → text recaps)
    1511: (
        "<p><strong>Key takeaway</strong>: Set aside a sinking fund from the rent to cover future repairs, replacements, and big maintenance. "
        "That way you avoid scrambling for cash when the boiler fails or the roof needs work.</p>"
    ),
    1516: (
        "<p><strong>Key takeaway</strong>: When verifying income, rely on payslips, tax returns, or bank statements rather than verbal claims. "
        "Document everything and cross-check numbers so you know the tenant can afford the rent.</p>"
    ),
    1521: (
        "<p><strong>Key takeaway</strong>: The best time to buy is when you find a property that fits your strategy and you can afford it—not based on trying to time the market. "
        "Understand where you are in the cycle so you can set realistic expectations and hold for the long term if needed.</p>"
    ),
    1531: (
        "<p><strong>Key takeaway</strong>: Commercial property value is primarily determined by the income it produces (rents and lease terms), not just comparable sales. "
        "Learn to analyse net operating income and cap rates when evaluating deals.</p>"
    ),
    1536: (
        "<p><strong>Key takeaway</strong>: If you lose your private keys or seed phrase, you typically lose access to your crypto for good—no bank or support line can recover it. "
        "Store backups securely offline and never share your seed phrase with anyone.</p>"
    ),
    1546: (
        "<p><strong>Key takeaway</strong>: To use a DEX you need a wallet that supports the right network, some crypto for the trade and for gas fees, and an understanding of slippage and liquidity. "
        "Connect only to official front-ends and double-check addresses before you sign.</p>"
    ),
    1551: (
        "<p><strong>Key takeaway</strong>: A crypto tax event is typically triggered when you sell, swap, or spend crypto, or when you receive it as payment or reward. "
        "Track these events and keep records so you can report accurately and avoid surprises at tax time.</p>"
    ),
    1556: (
        "<p><strong>Key takeaway</strong>: A key feature of a smart contract is that it runs automatically when conditions are met, without a middleman. "
        "The code defines the rules; once deployed, it executes as written, so understanding and auditing the code matters.</p>"
    ),
    1566: (
        "<p><strong>Key takeaway</strong>: The wick on a candlestick shows the highest and lowest prices during that period; the body shows where price opened and closed. "
        "Wicks help you see rejection and volatility, which is useful for support, resistance, and entry decisions.</p>"
    ),
    1571: (
        "<p><strong>Key takeaway</strong>: Revenge trading is making impulsive trades to win back losses, which usually leads to more risk and bigger losses. "
        "Stick to your plan, take breaks after a bad trade, and treat each trade on its own merits.</p>"
    ),
    1576: (
        "<p><strong>Key takeaway</strong>: The main purpose of backtesting is to see how a strategy would have performed on past data before you risk real money. "
        "Use it to refine rules and manage expectations; remember that past results do not guarantee future performance.</p>"
    ),
    1586: (
        "<p><strong>Key takeaway</strong>: Recording your emotions in a trading journal helps you spot patterns—for example, overtrading when you're overconfident or freezing after a loss. "
        "Over time you can adjust your process and improve discipline.</p>"
    ),
    1596: (
        "<p><strong>Key takeaway</strong>: The most important factor in couples budgeting is honest communication and agreement on priorities. "
        "Decide together how to split costs, save, and handle surprises so money supports your relationship instead of stressing it.</p>"
    ),
    1606: (
        "<p><strong>Key takeaway</strong>: Lifestyle creep is when your spending rises as your income rises, so you don't feel any better off. "
        "Counter it by saving or investing raises first, setting limits on flexible spending, and checking in on what you really value.</p>"
    ),
    1621: (
        "<p><strong>Key takeaway</strong>: The main goal of a No-Spend challenge is to break automatic spending habits and see where your money actually goes. "
        "Use the pause to plan, use what you have, and reset your relationship with non-essential spending.</p>"
    ),
    1626: (
        "<p><strong>Key takeaway</strong>: The most important factor in compound interest is time—the longer your money grows, the more the compounding effect. "
        "Starting early and staying invested usually beats trying to catch up later with larger contributions.</p>"
    ),
    1636: (
        "<p><strong>Key takeaway</strong>: A scarcity mindset can make you focus on short-term survival, avoid risk, and miss opportunities that could improve your finances. "
        "Shifting toward abundance—without ignoring real constraints—helps you plan and act with more clarity and less fear.</p>"
    ),
    1646: (
        "<p><strong>Key takeaway</strong>: Automation is often better than willpower because it removes the need to decide every time—savings and bills happen before you can spend the money. "
        "Set up automatic transfers to savings and debt so good habits run in the background.</p>"
    ),
    1661: (
        "<p><strong>Key takeaway</strong>: When income drops unexpectedly, the first step is to stabilise: cut non-essential spending, use emergency savings if you have them, and see what support or flexibility you can get. "
        "Then adjust your budget and plan until you're back on your feet.</p>"
    ),
    1666: (
        "<p><strong>Key takeaway</strong>: The growth mindset approach to a financial loss is to treat it as a lesson: what went wrong, what you'd do differently, and how to protect yourself next time. "
        "It focuses on learning and improving instead of blaming or avoiding the topic.</p>"
    ),
}


class Command(BaseCommand):
    help = "Replace generic Quick Check sections with text lesson recaps."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Show what would be changed without saving."
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("DRY RUN – no changes will be saved.")

        updated = 0
        for section_id in SECTION_IDS:
            section = LessonSection.objects.filter(id=section_id).first()
            if not section:
                self.stdout.write(self.style.WARNING(f"Section {section_id} not found, skipping."))
                continue

            text_content = LESSON_RECAPS.get(section_id)
            if not text_content:
                self.stdout.write(
                    self.style.WARNING(f"No recap for section {section_id}, skipping.")
                )
                continue

            if dry_run:
                self.stdout.write(
                    f"Would convert section {section_id} ({section.lesson.title}) from exercise to text."
                )
                updated += 1
                continue

            section.content_type = "text"
            section.text_content = text_content
            section.title = "Key takeaway"
            section.exercise_type = None
            section.exercise_data = None
            section.save(
                update_fields=[
                    "content_type",
                    "text_content",
                    "title",
                    "exercise_type",
                    "exercise_data",
                ]
            )

            for trans in LessonSectionTranslation.objects.filter(section_id=section_id):
                trans.title = "Key takeaway"
                trans.text_content = text_content
                trans.exercise_data = None
                trans.save(update_fields=["title", "text_content", "exercise_data"])

            updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Replaced {updated} section(s) with lesson recaps."
                if not dry_run
                else f"Would replace {updated} section(s)."
            )
        )
