dotenv.config();
import axios from 'axios';
import puppeteer from 'puppeteer';
import { createObjectCsvWriter } from 'csv-writer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractZoningInfo, getMarketPricesEstimate } from './openai-service.js';

// Load environment variables


// Setup directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const location = process.env.DEFAULT_LOCATION || 'Seattle, WA';
const outputFile = path.join(__dirname, '../output.csv');
const USE_MOCK_DATA = !process.env.RAPID_API_KEY || process.env.USE_MOCK_DATA === 'true';

// CSV Writer setup
const csvWriter = createObjectCsvWriter({
  path: outputFile,
  header: [
    { id: 'address', title: 'Address/Land Identifier' },
    { id: 'pricePerSqFt', title: 'Price per Square Feet' },
    { id: 'avgLandPricePerSqFt', title: 'Average Land Price in Area per SqFt' },
    { id: 'avgAptPricePerSqFt', title: 'Average Apartment Price in Area per SqFt' },
    { id: 'buildablePercentage', title: 'Percentage of Buildable Area' }
  ]
});

async function main() {
  console.log(`Starting Zillow land data collection for ${location}...`);
  console.log(USE_MOCK_DATA ? 'Using mock data (no API keys provided)' : 'Using live API data');
  
  try {
    // 1. Fetch land listings from Zillow
    const fullLandListings = await fetchLandListings(location);

    // Shorten the land listings to only include the first item - FOR TESTING PURPOSES.
    const landListings = fullLandListings.slice(0, 1);
    
    console.log(`Found ${landListings.length} land listings`);
    
    // 2. Process each listing to get additional data
    const processedListings = await processListings(landListings);
    
    // 3. Write to CSV
    await csvWriter.writeRecords(processedListings);
    console.log(`Data written to ${outputFile}`);
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Generate mock land listings for testing without API keys
// function generateMockListings() {
//   console.log('Generating mock land listings for testing...');
  
//   const neighborhoods = ['Ballard', 'Fremont', 'Wallingford', 'Queen Anne', 'Capitol Hill'];
//   const streetTypes = ['Ave', 'St', 'Blvd', 'Dr', 'Way', 'Pl'];
//   const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
  
//   return Array.from({ length: 10 }, (_, i) => {
//     const streetNum = Math.floor(Math.random() * 9000) + 1000;
//     const streetName = ['Pine', 'Oak', 'Maple', 'Cedar', 'Elm'][Math.floor(Math.random() * 5)];
//     const direction = directions[Math.floor(Math.random() * directions.length)];
//     const streetType = streetTypes[Math.floor(Math.random() * streetTypes.length)];
//     const neighborhood = neighborhoods[Math.floor(Math.random() * neighborhoods.length)];
    
//     const address = `${streetNum} ${streetName} ${streetType} ${direction}, ${neighborhood}, ${location}`;
//     const price = (Math.floor(Math.random() * 500) + 100) * 1000; // $100k-$600k
//     const lotSizeAcres = (Math.random() * 2 + 0.25).toFixed(2); // 0.25-2.25 acres
    
//     return {
//       address,
//       price: price.toString(),
//       zpid: `mock-${i + 1}`,
//       landSize: `${lotSizeAcres} acres`,
//       description: `Beautiful ${lotSizeAcres} acre lot in ${neighborhood}. Zoned for residential development.`,
//       fullDescription: `Beautiful ${lotSizeAcres} acre lot in ${neighborhood}. This property is located in a desirable area with good schools and easy access to amenities. The land is zoned R-1 for single-family residential development. Property has utilities available at the street.`
//     };
//   });
// }

async function fetchLandListings(location) {
  console.log(`Fetching land listings for ${location}...`);
  
  // Using RapidAPI for Zillow data
  try {
    const options = {
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
      params: {
        location: location,
        home_type: 'LAND'
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPID_API_KEY,
        'X-RapidAPI-Host': process.env.RAPID_API_HOST
      }
    };

    const response = await axios.request(options);
    return response.data.props || [];
  } catch (error) {
    console.error('Error fetching land listings:', error.message);
    
    // Fallback to web scraping if API fails
    try {
      return await scrapeLandListings(location);
    } catch (scrapeError) {
      console.error('Web scraping also failed:', scrapeError.message);
      console.log('Falling back to mock data...');
    //   return generateMockListings();
        return ''
    }
  }
}

async function scrapeLandListings(location) {
  console.log('Falling back to web scraping...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Format the location for URL
    const formattedLocation = location.replace(/,?\s+/g, '-').toLowerCase();
    const url = `https://www.zillow.com/${formattedLocation}/land/`;
    
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for selector
    await page.waitForSelector('.property-card, .list-card', { timeout: 10000 }).catch(() => {
      console.log('Selector timeout - page structure may have changed');
    });
    
    // Extract property data from the page
    const listings = await page.evaluate(() => {
      // Try different selectors as Zillow may change their page structure
      const cardSelectors = ['.property-card', '.list-card', '[data-test="property-card"]'];
      let items = [];
      
      for (const selector of cardSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          items = Array.from(elements);
          break;
        }
      }
      
      if (items.length === 0) {
        console.log('No property cards found on page');
        return [];
      }
      
      return items.map(item => {
        // Try different selectors for address
        const addressSelectors = [
          '.property-card-addr', 
          '.list-card-addr',
          '[data-test="property-card-addr"]'
        ];
        
        let address = '';
        for (const selector of addressSelectors) {
          const element = item.querySelector(selector);
          if (element) {
            address = element.textContent;
            break;
          }
        }
        
        // Similar approach for other fields
        const priceSelectors = [
          '.property-card-price', 
          '.list-card-price',
          '[data-test="property-card-price"]'
        ];
        
        let price = '';
        for (const selector of priceSelectors) {
          const element = item.querySelector(selector);
          if (element) {
            price = element.textContent;
            break;
          }
        }
        
        const descriptionSelectors = [
          '.property-card-description',
          '.list-card-description'
        ];
        
        let description = '';
        for (const selector of descriptionSelectors) {
          const element = item.querySelector(selector);
          if (element) {
            description = element.textContent;
            break;
          }
        }
        
        // Extract detail URL for further information
        const linkSelectors = [
          'a.property-card-link',
          'a.list-card-link',
          'a[href*="/homedetails/"]'
        ];
        
        let detailUrl = '';
        for (const selector of linkSelectors) {
          const element = item.querySelector(selector);
          if (element) {
            detailUrl = element.href;
            break;
          }
        }
        
        const zpid = item.getAttribute('data-zpid') || '';
        
        // Extract land size information
        const detailsSelectors = [
          '.property-card-details li', 
          '.list-card-details li'
        ];
        
        let landSize = '';
        for (const selector of detailsSelectors) {
          const elements = item.querySelectorAll(selector);
          if (elements.length > 1) {
            // Usually the second item is lot size
            landSize = elements[1].textContent;
            break;
          }
        }
        
        return {
          address,
          price: price.replace(/[^\d.]/g, ''),
          zpid,
          landSize,
          description,
          detailUrl
        };
      });
    });
    
    // If we couldn't get any listings, use mock data
    if (listings.length === 0) {
      console.log('No listings found, using mock data...');
      return generateMockListings();
    }
    
    // Normally we would fetch detailed information for each property,
    // but for simplicity and to avoid rate limits we'll skip that for now
    
    return listings;
  } catch (error) {
    console.error('Error during web scraping:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function processListings(listings) {
  console.log('Processing listings...');
  const processedListings = [];
  
  for (const listing of listings) {
    try {
      // Get property details including zoning information
      const propertyDetails = await getPropertyDetails(listing);
      
      // Get area market data
      const marketData = await getAreaMarketData(listing.address);
      
      // Calculate buildable percentage based on zoning regulations
      const buildablePercentage = typeof propertyDetails.zoningInfo.buildablePercentageEstimate !== 'undefined'
        ? propertyDetails.zoningInfo.buildablePercentageEstimate * 100
        : calculateBuildablePercentage(propertyDetails.zoningInfo);
      
      // Calculate price per square foot
      const pricePerSqFt = calculatePricePerSqFt(listing.price, propertyDetails.lotSize);
      
      processedListings.push({
        address: listing.address,
        pricePerSqFt,
        avgLandPricePerSqFt: marketData.avgLandPricePerSqFt,
        avgAptPricePerSqFt: marketData.avgAptPricePerSqFt,
        buildablePercentage
      });
      
      console.log(`Processed: ${listing.address}`);
    } catch (error) {
      console.error(`Error processing listing ${listing.address}:`, error.message);
    }
  }
  
  return processedListings;
}

async function getPropertyDetails(listing) {
  // Extract property description for zoning analysis
  const propertyDescription = listing.fullDescription || listing.description || '';
  
  return {
    lotSize: extractLotSize(listing.landSize),
    zoningInfo: await fetchZoningInfo(listing.address, propertyDescription)
  };
}

function extractLotSize(sizeText) {
  // Parse lot size from text like "1.5 acres" or "10,000 sqft"
  if (!sizeText) return 0;
  
  const numericValue = parseFloat(sizeText.replace(/[^\d.]/g, ''));
  
  if (sizeText.toLowerCase().includes('acre')) {
    return numericValue * 43560; // Convert acres to square feet
  }
  
  return numericValue; // Assume square feet if not specified
}

async function fetchZoningInfo(address, propertyDescription) {
  // Use OpenAI to extract zoning information
  console.log(`Fetching zoning info for ${address}...`);
  return await extractZoningInfo(propertyDescription, address);
}

async function getAreaMarketData(address) {
  // Use OpenAI to get market data estimates
  console.log(`Fetching market data for area around ${address}...`);
  return await getMarketPricesEstimate(address);
}

function calculateBuildablePercentage(zoningInfo) {
  // Calculate buildable area percentage based on zoning regulations
  // This is a simplified calculation and would be more complex in reality
  
  // Basic calculation: Lot coverage minus setback requirements
  const buildablePercentage = zoningInfo.lotCoverage * 100;
  
  return buildablePercentage;
}

function calculatePricePerSqFt(price, sqFt) {
  if (!price || !sqFt || sqFt === 0) return 0;
  return (price / sqFt).toFixed(2);
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error in main function:', error);
}); 