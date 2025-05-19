import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";
import { useAuth } from "./AuthContext";

const Chatbot = ({ isVisible, setIsVisible, isMobile }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const messagesEndRef = useRef(null);
  const { getAccessToken } = useAuth();

  // Enhanced financial FAQ with more detailed responses and additional topics
  const FINANCE_FAQ = {
    budgeting:
      "Budgeting is the process of creating a plan to spend your money wisely. This spending plan helps ensure you have enough for necessities while working toward financial goals. I recommend starting with the 50/30/20 rule: allocate 50% of your income to needs, 30% to wants, and 20% to savings and debt repayment. For precise budgeting, consider using zero-based budgeting where every dollar has a purpose.",
    saving:
      "When it comes to saving money, consistency is key. Set up automatic transfers to your savings account on payday. Consider high-yield savings accounts for your emergency fund (aim for 3-6 months of expenses). For long-term goals, look into certificates of deposit (CDs) or money market accounts. Remember to prioritize savings by treating it as a non-negotiable expense in your budget.",
    investing:
      "Investing means putting money into assets with the expectation of growth. Start with broad index funds for diversification. If your employer offers a 401(k) match, contribute at least enough to get the full match - it's essentially free money. For taxable investments, consider low-cost ETFs that track major indices like the S&P 500. Remember that asset allocation should align with your risk tolerance and time horizon.",
    "credit score":
      "Your credit score (ranging from 300-850) is a numerical representation of your creditworthiness. To improve it: pay all bills on time (35% of your score), keep credit utilization below 30% (30% of score), maintain a long credit history (15%), have a diverse credit mix (10%), and limit new credit applications (10%). Request your free credit report annually from each of the three major bureaus to check for errors.",
    retirement:
      "For retirement planning, take advantage of tax-advantaged accounts like 401(k)s and IRAs. The power of compound interest means starting early is crucial - even small contributions can grow significantly over decades. A common guideline is to save 15% of your income for retirement. Consider the 4% rule for withdrawals during retirement: you can typically withdraw 4% of your retirement savings annually without depleting your principal.",
    "debt management":
      "When managing debt, focus first on high-interest debt like credit cards. Consider the avalanche method (targeting highest interest rates first) or the snowball method (paying off smallest balances first for psychological wins). For student loans, look into income-driven repayment plans or refinancing options. Debt consolidation can be beneficial if it lowers your overall interest rate and you have a plan to avoid accumulating new debt.",
    "emergency fund":
      "An emergency fund is your financial safety net. Aim to save 3-6 months of essential expenses in a readily accessible account. Start with a goal of $1,000, then build from there. This fund helps prevent going into debt when unexpected expenses arise. Keep your emergency fund separate from your regular checking account to avoid the temptation to spend it, and consider a high-yield savings account to earn interest while maintaining liquidity.",
    "tax planning":
      "Effective tax planning can significantly increase your net worth. Maximize contributions to tax-advantaged accounts, harvest tax losses in investment accounts, and keep records of deductible expenses. Consider timing income and deductions strategically across tax years. For small business owners, understand qualified business deductions and retirement plan options like SEP IRAs or Solo 401(k)s. Consult with a tax professional for personalized strategies.",
    stocks:
      "Stocks represent ownership in a company. When investing in stocks, focus on diversification across sectors and company sizes. For most people, low-cost index funds are the best approach rather than picking individual stocks. Dollar-cost averaging (investing fixed amounts at regular intervals) can reduce the impact of market volatility. Remember that the stock market has historically yielded around 7% annually over the long term, despite short-term fluctuations.",
    cryptocurrencies:
      "Cryptocurrencies are highly volatile digital assets. While they offer potential for significant returns, they also come with substantial risk. Consider allocating only a small percentage of your portfolio to crypto (generally no more than 5%), and only invest what you can afford to lose. Research thoroughly before investing in any specific cryptocurrency. Understand the difference between coins, tokens, and blockchain technology to make informed decisions.",
    inflation:
      "Inflation erodes the purchasing power of money over time. To protect your wealth against inflation, invest in assets that historically outpace inflation rates, such as stocks, TIPS (Treasury Inflation-Protected Securities), real estate, and certain commodities. The 'Rule of 72' helps estimate how quickly inflation will halve your purchasing power: divide 72 by the inflation rate to determine the number of years it will take.",
    mortgages:
      "When considering a mortgage, compare not just interest rates but also terms, fees, and whether the rate is fixed or adjustable. The traditional advice is to keep housing costs under 28% of your gross income. Consider the total cost of homeownership including property taxes, insurance, maintenance, and HOA fees. For refinancing, calculate the break-even point to ensure the closing costs are justified by interest savings.",
    "financial independence":
      "Financial independence means having enough passive income to cover your living expenses without needing active income from work. The FIRE (Financial Independence, Retire Early) movement suggests saving 50-70% of your income and investing it in diversified assets. A common FIRE calculation is the '25x rule': multiply your annual expenses by 25 to determine the investment portfolio needed to generate sufficient passive income.",
    "estate planning":
      "Estate planning involves preparing for the transfer of assets upon death. Essential documents include a will, durable power of attorney, healthcare directives, and potentially trusts. Update beneficiaries on retirement accounts and insurance policies regularly, as these designations often supersede instructions in a will. Review your estate plan after major life events like marriage, divorce, or the birth of children.",
    "insurance planning":
      "Proper insurance coverage protects your financial health from catastrophic events. Consider term life insurance (typically 10-12 times your annual income) if you have dependents, disability insurance to protect your income, health insurance with appropriate deductibles and coverage, property insurance for your home and possessions, and liability insurance to protect against lawsuits. Regularly review policies to ensure adequate coverage as your circumstances change.",
    "compound interest":
      "Compound interest is often called the eighth wonder of the world - it's interest earned on both the principal and previously accumulated interest. Unlike simple interest which only applies to the initial amount, compound interest creates exponential growth over time. The formula is A = P(1 + r/n)^(nt), where A is the final amount, P is principal, r is rate, n is compounding frequency, and t is time. The Rule of 72 provides a quick estimate: divide 72 by the interest rate to determine how long it takes your money to double. Starting early is crucial - even small amounts can grow substantially due to compounding.",
    "buying a house":
      "Buying a house involves several steps: 1) Check your credit score and improve it if needed, 2) Save for a down payment (typically 3-20% of purchase price), 3) Get pre-approved for a mortgage to understand your budget, 4) Find a good real estate agent, 5) Search for homes within your budget, 6) Make an offer and negotiate, 7) Complete a home inspection, 8) Finalize your mortgage application, and 9) Close on the property. First-time homebuyer programs can provide assistance with down payments and closing costs. Ensure your monthly housing costs stay under 28-30% of your gross income for affordability.",
  };

  useEffect(() => {
    if (isVisible && !hasGreeted) {
      setMessages([
        {
          sender: "bot",
          text: "Hello! I'm your financial assistant. Ask me about budgeting, investing, saving, cryptocurrencies, retirement planning, or any other finance topic. How can I help you today?",
        },
      ]);
      setHasGreeted(true);
    }
  }, [isVisible, hasGreeted]);

  useEffect(() => {
    // Auto-scroll chat history to bottom when new messages appear
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        setSelectedVoice(
          (prev) =>
            prev || availableVoices.find((v) => v.default) || availableVoices[0]
        );
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    if (isMobile && voices.length === 0) {
      const interval = setInterval(() => {
        const mobileVoices = window.speechSynthesis.getVoices();
        if (mobileVoices.length > 0) {
          clearInterval(interval);
          loadVoices();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isMobile, voices.length]);

  const speakResponse = useCallback(
    (text) => {
      if (!isSpeechEnabled || !selectedVoice) return;

      const handleSpeak = () => {
        const MAX_CHAR_LIMIT = 200;
        const sentences =
          text.match(new RegExp(`.{1,${MAX_CHAR_LIMIT}}(\\s|$)`, "g")) || [];

        window.speechSynthesis.cancel();

        let index = 0;
        const speakNextSentence = () => {
          if (index < sentences.length) {
            const speech = new SpeechSynthesisUtterance(sentences[index]);
            speech.voice = selectedVoice;

            speech.onend = () => {
              index++;
              speakNextSentence();
            };

            window.speechSynthesis.speak(speech);
          }
        };

        speakNextSentence();
      };

      if (isMobile) {
        const clickHandler = () => {
          handleSpeak();
          document.body.removeEventListener("click", clickHandler);
        };
        document.body.addEventListener("click", clickHandler);
      } else {
        handleSpeak();
      }
    },
    [isSpeechEnabled, selectedVoice, isMobile]
  );

  const checkFinancialQuery = async (message) => {
    const lowercaseMsg = message.toLowerCase();

    // First check for direct keyword matches in FAQ
    for (const [key, value] of Object.entries(FINANCE_FAQ)) {
      if (lowercaseMsg.includes(key)) {
        return value;
      }
    }

    // More sophisticated matching for FAQ topics with common variations and phrases
    const topicMap = {
      // Existing mappings
      "401k": "retirement",
      ira: "retirement",
      pension: "retirement",
      "save for retirement": "retirement",
      "retirement account": "retirement",
      "retirement planning": "retirement",
      budget: "budgeting",
      "spending plan": "budgeting",
      "track expenses": "budgeting",
      "save money": "saving",
      "savings account": "saving",
      "rainy day fund": "emergency fund",
      "backup money": "emergency fund",
      "financial cushion": "emergency fund",
      "safety net": "emergency fund",
      "credit report": "credit score",
      "credit history": "credit score",
      fico: "credit score",
      "credit bureau": "credit score",
      "pay off debt": "debt management",
      "debt payoff": "debt management",
      loan: "debt management",
      "tax deduction": "tax planning",
      "tax credit": "tax planning",
      "tax return": "tax planning",
      "stock market": "stocks",
      "invest in stocks": "stocks",
      equity: "stocks",
      bitcoin: "cryptocurrencies",
      ethereum: "cryptocurrencies",
      crypto: "cryptocurrencies",
      btc: "cryptocurrencies",
      eth: "cryptocurrencies",
      "rising prices": "inflation",
      "cost of living": "inflation",
      "purchasing power": "inflation",
      cpi: "inflation",
      "consumer prices": "inflation",
      "home loan": "mortgages",
      "house payment": "mortgages",
      refinance: "mortgages",
      "financial freedom": "financial independence",
      "fire movement": "financial independence",
      "retire early": "financial independence",
      will: "estate planning",
      trust: "estate planning",
      inheritance: "estate planning",
      beneficiary: "estate planning",
      "insurance policy": "insurance planning",
      "life insurance": "insurance planning",
      coverage: "insurance planning",
      "health insurance": "insurance planning",

      // New compound interest variations
      "interest compounding": "compound interest",
      "compounding returns": "compound interest",
      "compounding effect": "compound interest",
      "interest on interest": "compound interest",
      "money grows over time": "compound interest",
      "exponential growth": "compound interest",
      "rule of 72": "compound interest",
      "interest calculation": "compound interest",
      "investment growth": "compound interest",
      "annual percentage yield": "compound interest",
      apy: "compound interest",
      "compound annually": "compound interest",
      "compound monthly": "compound interest",

      // New house buying keywords
      "buy a house": "buying a house",
      "home buying": "buying a house",
      "purchase a home": "buying a house",
      "first time home buyer": "buying a house",
      "down payment": "buying a house",
      "mortgage process": "buying a house",
      "house hunting": "buying a house",
      "real estate purchase": "buying a house",
      "closing costs": "buying a house",
      "how can i buy a house": "buying a house",
      "how to buy a house": "buying a house",
      "steps to buy a house": "buying a house",
      "buying my first home": "buying a house",
    };

    for (const [phrase, topic] of Object.entries(topicMap)) {
      if (lowercaseMsg.includes(phrase)) {
        return FINANCE_FAQ[topic];
      }
    }

    // Stock price checking
    if (
      lowercaseMsg.includes("stock price") ||
      lowercaseMsg.includes("stock value") ||
      lowercaseMsg.match(/price of (.*?) stock/) ||
      lowercaseMsg.match(/how much is (.*?) stock/) ||
      lowercaseMsg.match(/stock quote for (.*)/) ||
      lowercaseMsg.match(/ticker (.*)/)
    ) {
      const words = lowercaseMsg.split(" ");
      let ticker = "";

      // Try to extract stock ticker or name
      if (lowercaseMsg.includes("ticker")) {
        const tickerIndex = words.indexOf("ticker");
        if (tickerIndex !== -1 && tickerIndex + 1 < words.length) {
          ticker = words[tickerIndex + 1].toUpperCase();
        }
      } else if (lowercaseMsg.includes("stock")) {
        const stockIndex = words.indexOf("stock");
        if (stockIndex > 0) {
          ticker = words[stockIndex - 1].toUpperCase();
        }
      }

      // Default fallback if no ticker was found
      if (!ticker) {
        ticker = words[words.length - 1].toUpperCase();
      }

      return await fetchStockPrice(ticker);
    }

    // Crypto price checking with broader pattern matching
    if (
      lowercaseMsg.includes("crypto") ||
      lowercaseMsg.includes("bitcoin") ||
      lowercaseMsg.includes("ethereum") ||
      lowercaseMsg.includes("cryptocurrency") ||
      lowercaseMsg.match(/price of (.*?) coin/) ||
      lowercaseMsg.match(/price of (.*?) token/) ||
      lowercaseMsg.includes("btc") ||
      lowercaseMsg.includes("eth") ||
      lowercaseMsg.includes("altcoin")
    ) {
      let cryptoId = "bitcoin"; // Default

      // Expanded crypto detection
      if (lowercaseMsg.includes("ethereum") || lowercaseMsg.includes("eth")) {
        cryptoId = "ethereum";
      } else if (
        lowercaseMsg.includes("dogecoin") ||
        lowercaseMsg.includes("doge")
      ) {
        cryptoId = "dogecoin";
      } else if (
        lowercaseMsg.includes("litecoin") ||
        lowercaseMsg.includes("ltc")
      ) {
        cryptoId = "litecoin";
      } else if (
        lowercaseMsg.includes("cardano") ||
        lowercaseMsg.includes("ada")
      ) {
        cryptoId = "cardano";
      } else if (
        lowercaseMsg.includes("solana") ||
        lowercaseMsg.includes("sol")
      ) {
        cryptoId = "solana";
      } else if (
        lowercaseMsg.includes("binance") ||
        lowercaseMsg.includes("bnb")
      ) {
        cryptoId = "binancecoin";
      } else if (
        lowercaseMsg.includes("ripple") ||
        lowercaseMsg.includes("xrp")
      ) {
        cryptoId = "ripple";
      } else if (
        lowercaseMsg.includes("polkadot") ||
        lowercaseMsg.includes("dot")
      ) {
        cryptoId = "polkadot";
      }

      return await fetchCryptoPrice(cryptoId);
    }

    // Forex/currency exchange rate checking
    if (
      lowercaseMsg.includes("forex") ||
      lowercaseMsg.includes("currency") ||
      lowercaseMsg.includes("exchange rate") ||
      lowercaseMsg.includes("exchange rates") ||
      lowercaseMsg.includes("convert") ||
      lowercaseMsg.match(/how much is (.*?) in (.*)/)
    ) {
      let fromCurrency = "usd";
      let toCurrency = "eur";

      // Try to extract currencies from the message
      const currencyCodes = [
        "usd",
        "eur",
        "gbp",
        "jpy",
        "cad",
        "aud",
        "chf",
        "nzd",
        "cny",
        "hkd",
        "sgd",
        "inr",
        "mxn",
        "brl",
        "zar",
        "rub",
        "try",
      ];

      // First pass - extract both currencies if possible
      for (const code of currencyCodes) {
        if (lowercaseMsg.includes(code)) {
          if (fromCurrency === "usd") {
            fromCurrency = code;
          } else {
            toCurrency = code;
            break;
          }
        }
      }

      // Pattern match "X to Y" or "X in Y"
      const toMatch = lowercaseMsg.match(/([\w]{3}) to ([\w]{3})/);
      const inMatch = lowercaseMsg.match(/([\w]{3}) in ([\w]{3})/);

      if (
        toMatch &&
        currencyCodes.includes(toMatch[1].toLowerCase()) &&
        currencyCodes.includes(toMatch[2].toLowerCase())
      ) {
        fromCurrency = toMatch[1].toLowerCase();
        toCurrency = toMatch[2].toLowerCase();
      } else if (
        inMatch &&
        currencyCodes.includes(inMatch[1].toLowerCase()) &&
        currencyCodes.includes(inMatch[2].toLowerCase())
      ) {
        fromCurrency = inMatch[1].toLowerCase();
        toCurrency = inMatch[2].toLowerCase();
      }

      return await fetchForexRate(fromCurrency, toCurrency);
    }

    // Inflation calculator
    if (
      lowercaseMsg.includes("inflation") ||
      lowercaseMsg.includes("purchasing power") ||
      lowercaseMsg.includes("worth in") ||
      lowercaseMsg.match(/value of (.*?) in (.*?) years/)
    ) {
      // Simple inflation calculator response
      return "Based on the historical average inflation rate of about 2-3% annually in the US, $100 today would be worth approximately $128 in 10 years and $164 in 20 years. For more precise calculations, consider specific inflation periods and regional variations.";
    }

    return null;
  };

  const fetchForexRate = async (from, to) => {
    try {
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/${from}`
      );

      if (
        !response.data ||
        !response.data.rates ||
        !response.data.rates[to.toUpperCase()]
      ) {
        return `Sorry, I couldn't retrieve the exchange rate from ${from.toUpperCase()} to ${to.toUpperCase()} at the moment.`;
      }

      const rate = response.data.rates[to.toUpperCase()];
      const date = new Date(
        response.data.time_last_updated * 1000
      ).toLocaleDateString();

      return `As of ${date}, the exchange rate from ${from.toUpperCase()} to ${to.toUpperCase()} is ${rate}. This means 1 ${from.toUpperCase()} equals ${rate} ${to.toUpperCase()}.`;
    } catch (error) {
      console.error("Error fetching Forex rates:", error);
      return "Sorry, I couldn't fetch Forex rates at the moment. Please try again later or check a financial website like xe.com for current exchange rates.";
    }
  };

  const fetchStockPrice = async (symbol) => {
    try {
      // Using Alpha Vantage API for stock data - fallback to mock data if unavailable
      const response = await axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${
          process.env.REACT_APP_ALPHA_VANTAGE_API_KEY || "demo"
        }`
      );

      if (
        response.data &&
        response.data["Global Quote"] &&
        response.data["Global Quote"]["05. price"]
      ) {
        const price = response.data["Global Quote"]["05. price"];
        const change = response.data["Global Quote"]["09. change"];
        const changePercent =
          response.data["Global Quote"]["10. change percent"];

        return `The current price of ${symbol.toUpperCase()} is $${parseFloat(
          price
        ).toFixed(2)} USD. Today's change: ${parseFloat(change).toFixed(
          2
        )} (${changePercent})`;
      } else {
        // Use CoinGecko as fallback for popular tech stocks that might be misidentified as crypto
        try {
          const fallbackResponse = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`
          );

          if (fallbackResponse.data[symbol.toLowerCase()]) {
            return `The current price of ${symbol.toUpperCase()} is $${
              fallbackResponse.data[symbol.toLowerCase()].usd
            } USD. (Note: This data might be for a cryptocurrency with a similar ticker)`;
          } else {
            return `Sorry, I couldn't find the stock price for ${symbol}. Please check the ticker symbol and try again.`;
          }
        } catch (fallbackError) {
          return `Sorry, I couldn't find the stock price for ${symbol}. Please check the ticker symbol and try again.`;
        }
      }
    } catch (error) {
      console.error("Error fetching stock price:", error);
      return "Sorry, I couldn't retrieve stock data. This might be due to API limitations or an invalid ticker symbol. Try checking a financial website like Yahoo Finance for this information.";
    }
  };

  const fetchCryptoPrice = async (cryptoId) => {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
      );

      if (response.data[cryptoId]) {
        const price = response.data[cryptoId].usd;
        const change = response.data[cryptoId].usd_24h_change;
        const marketCap = response.data[cryptoId].usd_market_cap;

        let changeText = "";
        if (change !== undefined) {
          const changeDirection = change >= 0 ? "up" : "down";
          changeText = ` It has moved ${changeDirection} ${Math.abs(
            change
          ).toFixed(2)}% in the last 24 hours.`;
        }

        let marketCapText = "";
        if (marketCap !== undefined) {
          marketCapText = ` The market capitalization is $${(
            marketCap / 1000000000
          ).toFixed(2)} billion USD.`;
        }

        return `The current price of ${
          cryptoId.charAt(0).toUpperCase() + cryptoId.slice(1)
        } is $${price} USD.${changeText}${marketCapText}`;
      } else {
        return `Sorry, I couldn't find the price for ${cryptoId}. Please check the name and try again.`;
      }
    } catch (error) {
      console.error("Error fetching crypto price:", error);
      return "Sorry, I couldn't retrieve cryptocurrency data. This might be due to API limitations or an invalid crypto name. Try checking a site like CoinMarketCap for current prices.";
    }
  };

  const startVoiceRecognition = () => {
    if (
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      alert("Speech recognition is not supported in your browser");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Provide visual feedback that voice recognition is active
    setMessages((prev) => [
      ...prev,
      { sender: "system", text: "Listening..." },
    ]);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);

      setMessages((prev) => prev.filter((msg) => msg.text !== "Listening..."));

      // Auto-send the voice message
      handleMessageSend(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      // Remove the "Listening..." message in case of error
      setMessages((prev) => prev.filter((msg) => msg.text !== "Listening..."));
    };
  };

  const handleMessageSend = async (voiceInput = null) => {
    const input = voiceInput || inputMessage;
    if (!input.trim()) return;

    const newMessages = [...messages, { sender: "user", text: input }];
    setMessages(newMessages);
    setIsLoading(true);

    if (!voiceInput) {
      setInputMessage("");
    }

    try {
      // First check if it's a financial query that can be handled directly
      const financialData = checkFinancialQuery(input);

      if (financialData) {
        const defaultMessage =
          "I don't have specific information about that financial topic. Would you like me to explain budgeting, investing, savings strategies, retirement planning, or credit management instead?";
        handleFinancialQueryResult(financialData, defaultMessage);
        setIsLoading(false);
        return;
      }

      const apiUrl = process.env.REACT_APP_BACKEND_URL
        ? `${process.env.REACT_APP_BACKEND_URL}/proxy/hf/`
        : "https://andreineagoe23.pythonanywhere.com/api/proxy/hf/";

      // Add finance-specific system prompt
      const isFirstPrompt =
        newMessages.filter((msg) => msg.sender === "user").length === 1;

      const FINANCE_SYSTEM_PROMPT =
        "You are a helpful and knowledgeable financial assistant specializing in personal finance, investing, budgeting, and financial education. " +
        "Provide clear, accurate, and educational responses to financial questions. " +
        "When giving financial advice, emphasize fundamental principles and educational information rather than specific investment recommendations. " +
        "If you don't know the answer to a specific financial question, acknowledge it and suggest reliable resources. " +
        "Always clarify that your responses are for educational purposes only and not professional financial advice.\n\n";

      const formattedPrompt = isFirstPrompt
        ? FINANCE_SYSTEM_PROMPT + `User: ${input}\nAI:`
        : `User: ${input}\nAI:`;

      // Include chat history context when not the first message
      const contextualPrompt = !isFirstPrompt
        ? "Previous conversation:\n" +
          messages
            .slice(-4) // Last 4 messages for context
            .map(
              (msg) => `${msg.sender === "user" ? "User" : "AI"}: ${msg.text}`
            )
            .join("\n") +
          "\n\n" +
          formattedPrompt
        : formattedPrompt;

      console.log("Sending request to:", apiUrl);

      const response = await axios.post(
        apiUrl,
        {
          inputs: contextualPrompt,
          parameters: {
            max_new_tokens: 150, // Increased token limit for more detailed financial explanations
            temperature: 0.7,
            top_p: 0.9,
            repetition_penalty: 1.2,
            pad_token_id: 50256,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            "Content-Type": "application/json",
          },
        }
      );

      // ✅ Improved response processing to get clean answers
      let aiResponse = "I'm sorry, I couldn't generate a proper response.";

      // Create a function to aggressively clean responses
      const cleanResponseText = (text) => {
        // First attempt to extract just the AI's portion of the conversation
        if (text.includes("AI:")) {
          text = text.split("AI:").pop().trim();
        }

        // Remove any User/Human queries
        text = text.replace(/User:.*?(?=AI:|$)/gs, "");
        text = text.replace(/Human:.*?(?=AI:|$)/gs, "");

        // Remove introductory phrases
        const intro_phrases = [
          "I am a professional financial assistant",
          "As a financial assistant",
          "As an AI assistant",
          "I'd be happy to explain",
          "I'd be happy to help",
          "I'd be glad to help",
          "I can help with that",
          "Let me explain",
          "To answer your question",
          "Here's information about",
          "Great question",
          "Sure,",
          "Certainly,",
          "Absolutely,",
          "Hello,",
          "Hi,",
        ];

        for (const phrase of intro_phrases) {
          if (text.toLowerCase().startsWith(phrase.toLowerCase())) {
            text = text.substring(phrase.length).trim();
            // Remove comma if present at start
            if (text.startsWith(",")) {
              text = text.substring(1).trim();
            }
          }
        }

        // Remove repetitions of user's query
        const userQueryLower = input.toLowerCase().trim();
        const maxLength = Math.min(30, userQueryLower.length);
        for (let i = maxLength; i > 5; i--) {
          const queryStart = userQueryLower.substring(0, i);
          const regex = new RegExp(
            `(${escapeRegExp(queryStart)}[^.?!]*[.?!]\\s*){2,}`,
            "gi"
          );
          text = text.replace(regex, "");
        }

        // Remove exact repetitions of the user's query
        const escapedQuery = escapeRegExp(userQueryLower);
        text = text.replace(new RegExp(`^${escapedQuery}[?\\s]*`, "i"), "");

        // Remove AI: prefixes that might be left
        text = text.replace(/AI:\s*/g, "");

        return text.trim();
      };

      // Helper function to escape regex special characters
      const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      };

      if (typeof response.data === "object" && response.data?.response) {
        aiResponse = cleanResponseText(response.data.response);
      } else if (
        Array.isArray(response.data) &&
        response.data[0]?.generated_text
      ) {
        aiResponse = cleanResponseText(response.data[0].generated_text);
      } else if (response.data?.generated_text) {
        aiResponse = cleanResponseText(response.data.generated_text);
      } else if (typeof response.data === "string") {
        aiResponse = cleanResponseText(response.data);
      }

      // 🧩 Better fallbacks for financial topics if the model gives an unusable response
      if (!aiResponse || aiResponse.length < 10) {
        const fallbackQuery = checkFinancialQuery(input);
        const defaultMessage =
          "I don't have specific information about that financial topic. Would you like me to explain budgeting, investing, savings strategies, retirement planning, or credit management instead?";

        if (fallbackQuery) {
          handleFinancialQueryResult(fallbackQuery, defaultMessage);
        } else {
          updateChat(defaultMessage);
        }
      } else {
        updateChat(aiResponse);
      }
    } catch (error) {
      handleError(error, input);
    } finally {
      setIsLoading(false);
    }
  };

  const updateChat = (text) => {
    setMessages((prev) => [...prev, { sender: "bot", text }]);
    speakResponse(text);
  };

  // Safely handle both Promise-based and direct string returns from checkFinancialQuery
  const handleFinancialQueryResult = (result, defaultMessage) => {
    if (result instanceof Promise) {
      result
        .then((response) => {
          if (response) {
            updateChat(response);
          } else {
            updateChat(defaultMessage);
          }
        })
        .catch(() => {
          updateChat(defaultMessage);
        });
    } else if (result) {
      updateChat(result);
    } else {
      updateChat(defaultMessage);
    }
  };

  const handleError = (error, userQuery) => {
    console.error("Chat Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // More informative error handling with financial fallbacks
    let errorMessage;

    if (error.response?.status === 404) {
      errorMessage =
        "I'm having trouble connecting to our AI services. This appears to be a server configuration issue. Please try again later while we fix it.";
    } else if (
      error.response?.status === 401 ||
      error.response?.status === 403
    ) {
      errorMessage =
        "Your session may have expired. Please refresh the page and try logging in again.";
    } else if (error.response?.data?.error?.includes("Authorization")) {
      errorMessage = "System maintenance in progress. Please try again later.";
    } else {
      // Try to find a relevant FAQ answer from our improved query matching
      const financialFallback = checkFinancialQuery(userQuery);
      const defaultMessage =
        "I'm having trouble processing your request right now. Please try asking about common financial topics like budgeting, investing, saving, retirement planning, or credit management instead.";

      if (financialFallback) {
        handleFinancialQueryResult(financialFallback, defaultMessage);
        return; // Exit early since handleFinancialQueryResult will handle the response
      } else {
        // If no FAQ match, provide a generic but helpful response
        errorMessage =
          "I'm having trouble connecting to our financial data services at the moment. I can still answer general finance questions about budgeting, investing, saving, retirement planning, credit scores, and many other financial topics. What would you like to learn about?";
      }
    }

    setMessages((prev) => [...prev, { sender: "bot", text: errorMessage }]);
  };

  return (
    <div className="chatbot">
      {!isMobile && (
        <button
          className="chatbot-toggle btn-accent"
          onClick={() => setIsVisible(!isVisible)}
          aria-label="Open Finance Assistant"
        >
          💰
        </button>
      )}

      <div
        className={`chatbot-container ${isVisible ? "active" : ""} shadow-lg`}
      >
        <div className="chatbot-header d-flex align-items-center justify-content-between">
          <span className="fw-semibold">Finance Assistant</span>
          <button
            className="btn btn-link text-accent p-0"
            onClick={() => setIsVisible(false)}
            aria-label="Close Finance Assistant"
          >
            ✖
          </button>
        </div>

        <div className="tts-toggle-container px-3 py-2 d-flex align-items-center">
          <label className="switch me-2">
            <input
              type="checkbox"
              onChange={() => setIsSpeechEnabled(!isSpeechEnabled)}
              checked={isSpeechEnabled}
            />
            <span className="slider"></span>
          </label>
          <span className="text-muted">🔊 Speak Answers</span>

          {isSpeechEnabled && (
            <select
              className="form-select form-select-sm ms-auto"
              onChange={(e) =>
                setSelectedVoice(voices.find((v) => v.name === e.target.value))
              }
              value={selectedVoice?.name || ""}
              style={{ maxWidth: "150px" }}
            >
              {voices.length > 0 ? (
                voices.map((voice, index) => (
                  <option key={index} value={voice.name}>
                    {voice.name}
                  </option>
                ))
              ) : (
                <option>Loading voices...</option>
              )}
            </select>
          )}
        </div>

        <div className="chat-history p-3" ref={messagesEndRef}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message mb-2 ${
                msg.sender === "user"
                  ? "chat-user"
                  : msg.sender === "system"
                  ? "chat-system"
                  : "chat-bot"
              } p-3 rounded`}
            >
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div className="chat-bot typing-animation p-3 rounded">
              Typing...
            </div>
          )}
        </div>

        <div className="chat-input-container d-flex gap-2 p-3">
          <button
            className="btn btn-accent voice-button rounded-circle p-2"
            onClick={startVoiceRecognition}
            aria-label="Voice Input"
          >
            🎙
          </button>
          <input
            type="text"
            className="form-control rounded-pill"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMessageSend()}
            placeholder="Ask me about finance, budgeting, investing..."
            aria-label="Chat input"
          />
          <button
            className="btn btn-accent rounded-pill px-4"
            onClick={() => handleMessageSend()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
