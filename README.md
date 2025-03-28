# Zillow Land Analyzer

A Node.js script that fetches land listings from Zillow, analyzes zoning information, and exports a CSV with key metrics to help with real estate investment decisions.

## Features

- Fetches land-only listings from Zillow
- Calculates the percentage of land that is buildable based on zoning data
- Provides market comparisons for land and apartment prices
- Exports data to CSV format for easy analysis

## Prerequisites

- Node.js (v14+)
- npm or yarn
- API keys for:
  - RapidAPI (for Zillow data)
  - OpenAI API (for zoning analysis and market data estimations)

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your API keys in the `.env` file:
   ```
   RAPID_API_KEY="your_rapid_api_key"
   RAPID_API_HOST="zillow-com1.p.rapidapi.com"
   OPENAI_API_KEY="your_openai_api_key"
   DEFAULT_LOCATION="Seattle, WA"
   ```

## Usage

Run the script:

```
npm start
```

This will:
1. Fetch land listings from Zillow for the specified location
2. Analyze each listing to determine buildable area
3. Collect market pricing data
4. Export the results to `output.csv`

## Output Format

The CSV file will contain the following columns:

- **Address/Land Identifier**: The property address or identifier
- **Price per Square Feet**: The listing price divided by the total lot size
- **Average Land Price in Area per SqFt**: Average price for similar land in the area
- **Average Apartment Price in Area per SqFt**: Average price for apartments in the area
- **Percentage of Buildable Area**: Estimated percentage of the land that can be built on

## Notes

- The script initially attempts to use the RapidAPI Zillow API, but will fall back to web scraping if needed.
- Zoning information is approximate and should be verified with local authorities before making investment decisions.
- Market price data is estimated based on available information and may not reflect actual market conditions.

## License

MIT 