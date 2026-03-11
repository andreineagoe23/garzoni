"""
Manual curation pass for 10 high-impact lessons.
Keeps the existing lesson structure and updates wording quality in place.
"""

from django.core.management.base import BaseCommand

from education.models import Lesson, LessonSectionTranslation


def p(*paras: str) -> str:
    return "\n".join(f"<p>{x.strip()}</p>" for x in paras if x and x.strip())


CURATED = {
    2: {  # What is a Budget?
        1: p(
            "A budget is a decision system for your money, not a punishment plan. It tells each dollar where to go before the month starts.",
            "At minimum, a budget should cover essentials, debt or savings goals, and discretionary spending. If those categories are unclear, spending decisions become reactive and stress rises.",
            "A practical starting point is simple: estimate income, list fixed costs, then cap flexible categories like food, transport, and leisure.",
            "The hidden value of budgeting is timing control. You can align when bills are due, when savings are transferred, and when optional spending is allowed, which lowers the probability of cash shortfalls and late-payment fees.",
        ),
        2: {
            "question": "You want a budget that is realistic and sustainable. Which setup is most effective for your first month?",
            "options": [
                "Assign expected income to essentials, savings/debt, and capped flexible categories before spending starts.",
                "Track spending after the month and decide a budget only if you overspend.",
                "Set aggressive limits in every category even if they conflict with your current habits.",
                "Focus only on cutting leisure costs and ignore fixed bills for now.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "The goal of a budget is control and visibility. You should be able to answer three questions quickly: How much came in? Where did it go? What changed this month?",
            "Budgets fail when they are too detailed at the start. Begin with a small number of categories and tighten precision once your tracking habit is stable.",
            "Treat your first two months as calibration. You are building an operating model, not proving perfection.",
            "When your numbers are visible, you can make trade-offs deliberately. That is the difference between feeling busy with money tasks and actually improving your financial position.",
        ),
        5: p(
            "When income varies or expenses spike, adjust categories early instead of waiting for end-of-month damage control.",
            "A strong budgeting rhythm is weekly: review transactions, compare to planned amounts, and rebalance quickly.",
            "Over time, consistency matters more than strictness. A budget you can run for years beats an intense plan you abandon in weeks.",
        ),
        6: {
            "question": "Halfway through the month, your food spending is already 80% of plan. What is the best budgeting response?",
            "options": [
                "Reallocate from lower-priority categories now and set a tighter food cap for the remaining weeks.",
                "Ignore it and hope the final total balances out naturally.",
                "Stop tracking for the rest of the month to reduce stress.",
                "Use savings to maintain all planned spending categories unchanged.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "Budgeting works when it is clear, reviewed, and adjusted. Build the habit first, then improve precision.",
            "If you can forecast cash flow, catch overspending early, and still fund priorities, your budget is doing its job.",
        ),
    },
    3: {  # Importance of Budgeting
        1: p(
            "Budgeting matters because it converts financial goals into weekly behavior. Without a budget, goals remain intentions.",
            "People often underestimate how much small recurring expenses affect long-term outcomes. A budget makes those leaks visible.",
            "The biggest benefit is predictability: fewer surprises, better decisions, and less reliance on short-term credit.",
            "It also improves confidence in decision-making. When your baseline numbers are known, unexpected events become manageable adjustments instead of emergencies.",
        ),
        2: {
            "question": "Why is budgeting considered a high-leverage financial habit for people who want stable long-term progress?",
            "options": [
                "It links daily spending decisions to long-term goals and prevents invisible drift.",
                "It guarantees income growth regardless of spending behavior.",
                "It replaces the need for emergency savings.",
                "It removes uncertainty from all variable expenses.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "A budget also improves trade-off quality. When two priorities compete, you can choose intentionally instead of reacting emotionally.",
            "In households, shared budgets reduce conflict because expectations are explicit.",
            "From a risk perspective, budgeting reveals pressure points before they become debt events. That early warning function is one of its most practical benefits.",
            "Teams and families that review a shared budget regularly usually make faster, less emotional decisions because the rules are clear in advance.",
        ),
        5: p(
            "If a budget feels restrictive, simplify it. Complexity often kills compliance.",
            "Use a small number of categories, automate essentials and savings, and set guardrails for flexible spend.",
            "Progress is measured by reliability, not by perfect forecasting. If your system helps you detect drift quickly and correct it, it is working as intended.",
            "Reviewing spending at least weekly creates short feedback loops and prevents the end-of-month shock that causes people to abandon budgeting entirely.",
        ),
        6: {
            "question": "Which practical change most often improves budget adherence quickly for beginners and busy households?",
            "options": [
                "Reducing category complexity and introducing weekly review checkpoints.",
                "Adding many granular categories from day one.",
                "Reviewing only once per quarter.",
                "Tracking spending only when account balances are low.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "Budgeting is valuable because it makes your financial system measurable and correctable.",
            "The best budget is one you can maintain and improve over time.",
            "If you can identify drift early, protect essentials, and still fund priorities month after month, your budget is delivering real financial resilience.",
        ),
    },
    7: {  # What is Credit?
        1: p(
            "Credit is borrowed purchasing power that must be repaid under agreed terms. It can accelerate progress or create expensive drag, depending on how it is used.",
            "The core mechanics are principal, interest rate, repayment schedule, and penalties. If any one of these is misunderstood, cost rises quickly.",
            "Credit should be treated as a tool for planned outcomes, not as a substitute for weak cash flow management.",
            "A useful mindset is to view every borrowing decision as a future cash-flow commitment. If that commitment limits your ability to handle volatility, the loan structure is too aggressive for your current risk capacity.",
        ),
        2: {
            "question": "Which statement best describes responsible credit use?",
            "options": [
                "Use borrowing for planned needs, understand total cost, and protect repayment capacity.",
                "Borrow whenever monthly installments appear affordable.",
                "Prioritize low minimum payments over total interest cost.",
                "Open multiple credit lines to increase flexibility before building repayment discipline.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "Cost of credit is often hidden in time. Small interest differences become significant over long repayment periods.",
            "Before borrowing, test your plan against a stress scenario such as temporary income reduction.",
        ),
        5: p(
            "High-quality credit behavior includes paying on time, keeping utilization moderate, and avoiding borrowing for recurring lifestyle spend.",
            "Track statements monthly. Waiting until problems appear usually increases both cost and complexity.",
        ),
        6: {
            "question": "What protects you most from long-term credit problems?",
            "options": [
                "A repayment plan with on-time automation and utilization limits.",
                "Frequent balance transfers without changing spending behavior.",
                "Relying on minimum payments for all balances.",
                "Ignoring statement details as long as due dates are met.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "Credit becomes useful when it is intentional, measurable, and matched to repayment capacity.",
            "If repayment depends on optimism rather than plan quality, risk is already too high.",
        ),
    },
    8: {  # Types of Credit
        1: p(
            "Not all credit products behave the same. Revolving credit, installment loans, and secured lending each have different risk and cost profiles.",
            "Choosing the wrong product can lock you into unnecessary fees or weak repayment flexibility.",
        ),
        2: {
            "question": "What is the main advantage of matching credit type to purpose?",
            "options": [
                "You improve cost control and repayment fit for the underlying need.",
                "You eliminate interest cost entirely.",
                "You no longer need an emergency buffer.",
                "You avoid all score impact from borrowing.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "Revolving products are flexible but can become expensive if balances persist. Installment products offer structure but reduce flexibility once signed.",
            "Always compare APR, fees, prepayment terms, and consequences of late payment.",
        ),
        5: p(
            "A practical rule: short-lived consumption should not create long-lived debt.",
            "Use product structure to support repayment discipline, not to postpone difficult budget choices.",
        ),
        6: {
            "question": "Which borrowing choice is usually strongest for risk control?",
            "options": [
                "Select the product with terms that align to your cash-flow and payoff horizon.",
                "Select whichever lender approves the highest limit.",
                "Choose only by promotional rate and ignore fee structure.",
                "Use revolving credit by default for every purpose.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "Understanding credit types helps you borrow with intent instead of convenience.",
            "The right product reduces friction; the wrong product compounds mistakes.",
        ),
    },
    12: {  # Intro to Investing
        1: p(
            "Investing is the process of allocating capital to assets expected to grow purchasing power over time.",
            "Its purpose is not constant gains; it is long-term wealth building under uncertainty.",
            "Time horizon, diversification, and behavior discipline matter more than short-term predictions.",
        ),
        2: {
            "question": "Which principle is most important for beginner investors?",
            "options": [
                "Build a diversified plan aligned to horizon and risk tolerance, then contribute consistently.",
                "Optimize for the highest short-term return each quarter.",
                "Concentrate on a single high-conviction asset to maximize upside.",
                "Delay investing until market volatility disappears.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "Risk in investing is not just price movement; it includes concentration, behavior mistakes, fees, and inflation erosion.",
            "A strategy is robust when it remains valid under normal market drawdowns.",
        ),
        5: p(
            "Good investors define rules before emotions run high: contribution schedule, allocation bands, and rebalance logic.",
            "When outcomes disappoint, evaluate process quality first, then assumptions.",
        ),
        6: {
            "question": "During a market decline, what action best reflects a disciplined long-term investor?",
            "options": [
                "Follow the predefined allocation plan and rebalance if thresholds are breached.",
                "Sell everything to avoid temporary volatility.",
                "Stop contributions until prices fully recover.",
                "Switch strategy weekly based on market headlines.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "Investing success is usually process-driven: plan quality, diversification, and consistency over time.",
            "If your system depends on perfect timing, it is fragile by design.",
        ),
    },
    13: {  # Types of Investments
        1: p(
            "Asset classes behave differently across market conditions. Equities, bonds, cash-like assets, and alternatives each serve different portfolio jobs.",
            "Understanding role and risk is more useful than memorizing product names.",
        ),
        2: {
            "question": "Why combine multiple asset classes in one portfolio?",
            "options": [
                "To improve risk-adjusted outcomes and reduce dependence on one market regime.",
                "To guarantee positive returns every year.",
                "To remove the need for rebalancing.",
                "To avoid drawdowns entirely.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "Equities usually provide growth but with higher volatility. Bonds can stabilize cash flows but are sensitive to rate shifts. Cash preserves optionality but may lose purchasing power in inflationary periods.",
            "Portfolio design is about combining these properties, not chasing whichever asset recently outperformed.",
        ),
        5: p(
            "Before adding any investment, define why it belongs: return source, diversification impact, fee profile, and liquidity constraints.",
            "If you cannot explain its role, it likely adds complexity without improving outcomes.",
        ),
        6: {
            "question": "What is the best test before adding a new investment to a portfolio?",
            "options": [
                "Check whether it has a clear role and improves diversification relative to existing holdings.",
                "Check whether it is currently trending on social media.",
                "Check only last month's return.",
                "Check whether friends already own it.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "Investment types are tools. Their value depends on how they fit your objectives, risk budget, and time horizon.",
            "A coherent mix usually outperforms a collection of unrelated picks.",
        ),
    },
    17: {  # RE fundamentals
        1: p(
            "Real estate investing is a cash-flow and risk-management business, not just a price-appreciation story.",
            "Property outcomes depend on rent quality, financing terms, operating costs, vacancies, and local market dynamics.",
        ),
        2: {
            "question": "Which approach reflects professional real-estate fundamentals?",
            "options": [
                "Underwrite cash flow conservatively and stress-test vacancy, repairs, and financing costs.",
                "Assume market appreciation will offset weak cash flow.",
                "Choose properties mainly by interior aesthetics.",
                "Ignore operating reserves if current rent appears strong.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "A sound acquisition starts with underwriting assumptions you can defend: rent comps, occupancy, capex, taxes, insurance, and management friction.",
            "If the deal works only under optimistic assumptions, risk is likely mispriced.",
        ),
        5: p(
            "Post-purchase execution matters as much as deal selection. Tenant quality, maintenance response, and cost control determine realized returns.",
            "Keep a reserve policy for repairs and vacancy shocks to avoid forced decisions.",
        ),
        6: {
            "question": "What is a strong operating discipline after acquiring a rental property?",
            "options": [
                "Track occupancy, maintenance, and net cash flow monthly against underwriting assumptions.",
                "Review performance only when the property becomes cash negative.",
                "Delay routine maintenance to protect short-term margins.",
                "Increase rent aggressively each cycle without market validation.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "Real-estate fundamentals are about durable cash flow under uncertainty.",
            "Good operators protect downside first, then compound upside over time.",
        ),
    },
    18: {  # buying process
        1: p(
            "The buying process is a sequence: define criteria, secure financing, evaluate deals, perform due diligence, then close with clear risk controls.",
            "Skipping steps to move faster often transfers risk from analysis to expensive surprises.",
        ),
        2: {
            "question": "What is the highest-quality order for a property purchase decision?",
            "options": [
                "Set criteria and financing first, then underwrite, diligence, and close.",
                "Find a property first and solve financing details after making an offer.",
                "Prioritize speed over due diligence to avoid losing the deal.",
                "Close quickly and evaluate repair exposure post-purchase.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "Financing affects more than affordability; it changes cash flow resilience and ability to absorb vacancy or repairs.",
            "Underwriting should include downside cases before committing capital.",
        ),
        5: p(
            "Due diligence should verify physical condition, legal/title integrity, and financial assumptions.",
            "Document findings and define walk-away thresholds before negotiation pressure increases.",
        ),
        6: {
            "question": "Which due-diligence behavior best reduces acquisition risk?",
            "options": [
                "Use predefined pass/fail thresholds for structural, legal, and financial findings.",
                "Treat all issues as negotiable if the property location is strong.",
                "Ignore minor legal concerns when rental demand is high.",
                "Rely on seller-provided numbers without third-party verification.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "A disciplined buying process protects capital before growth assumptions are tested.",
            "The best deal is not the fastest close; it is the most robust under stress.",
        ),
    },
    26: {  # crypto basics
        1: p(
            "Cryptocurrency is a digital asset class built on distributed ledger systems. It combines technological innovation with high market and operational risk.",
            "Understanding custody, liquidity, and regulatory uncertainty is essential before capital allocation.",
        ),
        2: {
            "question": "What is the most important first principle for crypto beginners?",
            "options": [
                "Treat crypto as high-risk capital and prioritize custody/security controls before position size.",
                "Allocate most savings to crypto for faster long-term growth.",
                "Trade frequently to reduce exposure to volatility.",
                "Assume exchange custody is sufficient risk protection in all cases.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "Price action is only one layer of risk. Operational failures (lost keys, compromised accounts, bad permissions) can be irreversible.",
            "Portfolio sizing should reflect the possibility of both high volatility and permanent loss scenarios.",
        ),
        5: p(
            "Use clear guardrails: separate core savings from speculative capital, secure account access, and limit concentration in single tokens or venues.",
            "When evaluating projects, focus on utility, liquidity depth, governance risk, and contract security.",
        ),
        6: {
            "question": "Which portfolio rule best improves crypto risk management?",
            "options": [
                "Cap position size, diversify custody, and review operational security regularly.",
                "Use one exchange and one wallet for maximum convenience.",
                "Increase exposure after every winning trade.",
                "Ignore token concentration if short-term momentum is positive.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "Crypto can be part of a broader strategy only when security and risk controls are explicit.",
            "If process discipline is weak, volatility turns small mistakes into large losses quickly.",
        ),
    },
    35: {  # forex basics
        1: p(
            "Forex is the market for exchanging currencies, where price reflects relative macro expectations and liquidity conditions.",
            "Profitable participation depends less on prediction and more on risk control, execution quality, and process consistency.",
        ),
        2: {
            "question": "What principle matters most for beginner forex traders?",
            "options": [
                "Control downside with predefined risk per trade and strict execution rules.",
                "Increase leverage to maximize gains from small price moves.",
                "Trade every signal to gain more market exposure.",
                "Rely on intuition instead of written trade criteria.",
            ],
            "correctAnswer": 0,
        },
        3: p(
            "Currency moves are often driven by rate expectations, macro data, and sentiment shifts. A setup without context can have poor probability.",
            "Before entry, define invalidation level, target logic, and position size in advance.",
        ),
        5: p(
            "Execution discipline separates strategy from gambling. A good trade can lose; a bad trade can win. Judge process first.",
            "Use a journal to measure adherence to plan, slippage, and recurring mistakes under pressure.",
        ),
        6: {
            "question": "After a series of losses, what behavior best reflects professional forex discipline?",
            "options": [
                "Reduce size, review journal data, and resume only when setup criteria are objectively met.",
                "Double position size to recover quickly.",
                "Remove stop-loss levels to avoid being stopped out.",
                "Change strategy rules intraday after each loss.",
            ],
            "correctAnswer": 0,
        },
        7: p(
            "In forex, survival and consistency come before return optimization.",
            "Risk discipline, not prediction confidence, is the core skill that compounds over time.",
        ),
    },
}


class Command(BaseCommand):
    help = "Apply manual curation updates to 10 core lessons in place."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        updated_sections = 0

        for lesson_id, updates in CURATED.items():
            lesson = Lesson.objects.filter(id=lesson_id).first()
            if not lesson:
                self.stdout.write(self.style.WARNING(f"Lesson {lesson_id} not found."))
                continue

            for order, payload in updates.items():
                section = lesson.sections.filter(order=order).first()
                if not section:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Lesson {lesson_id} missing section order {order}, skipping."
                        )
                    )
                    continue

                if dry_run:
                    self.stdout.write(
                        f"Would update lesson {lesson_id} section {order} ({section.title})"
                    )
                    updated_sections += 1
                    continue

                if section.content_type == "exercise":
                    section.exercise_data = payload
                    section.save(update_fields=["exercise_data"])
                else:
                    section.text_content = payload
                    section.save(update_fields=["text_content"])

                for trans in LessonSectionTranslation.objects.filter(section=section):
                    if section.content_type == "exercise":
                        trans.exercise_data = payload
                        trans.save(update_fields=["exercise_data"])
                    else:
                        trans.text_content = payload
                        trans.save(update_fields=["text_content"])
                updated_sections += 1

        action = "Would update" if dry_run else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} {updated_sections} sections."))
