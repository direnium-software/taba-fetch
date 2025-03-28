import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service to interact with OpenAI API for extracting zoning information
 * from property descriptions and other land-related data
 */
export async function extractZoningInfo(propertyDescription, address) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a real estate and urban planning expert. Extract or estimate zoning information from property descriptions.'
          },
          {
            role: 'user',
            content: `Extract zoning information from this property located at ${address}. 
            Description: ${propertyDescription}
            
            Please return a JSON object with the following fields:
            - zoneType: The zoning classification (e.g., R-1, Commercial, etc.)
            - lotCoverage: The maximum percentage of the lot that can be covered by structures (as a decimal, e.g., 0.35 for 35%)
            - heightLimit: Maximum building height in feet
            - setbacks: An object with front, sides, and rear setback requirements in feet
            - additionalRestrictions: Any other notable restrictions
            - buildablePercentageEstimate: Your estimate of the total percentage of the lot that is buildable (as a decimal, e.g., 0.6 for 60%)
            
            If the description doesn't explicitly mention a value, use your expert knowledge to make a reasonable estimate based on the location and description.`
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    // Extract the JSON object from the response
    const aiResponse = response.data.choices[0].message.content;
    
    // Find the JSON object in the response (it might be wrapped in markdown code blocks)
    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || 
                      aiResponse.match(/```\n([\s\S]*?)\n```/) || 
                      [null, aiResponse];
    
    const jsonStr = jsonMatch[1];
    try {
      const zoningInfo = JSON.parse(jsonStr);
      return zoningInfo;
    } catch (e) {
      console.error('Failed to parse OpenAI response as JSON:', jsonStr);
      return 'Error parsing OpenAI response as JSON'
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error.message);
    return 'Error calling OpenAI API'
  }
}

/**
 * Get an estimate of market prices in a specific area
 */
export async function getMarketPricesEstimate(address) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a real estate market expert with access to current pricing data.'
          },
          {
            role: 'user',
            content: `Provide current market price estimates for ${address}.
            
            Please return a JSON object with the following fields:
            - avgLandPricePerSqFt: Average price per square foot for vacant land in this area
            - avgAptPricePerSqFt: Average price per square foot for apartments in this area
            
            Base this on your knowledge of real estate markets. Provide realistic estimates in USD.`
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    // Extract the JSON object from the response
    const aiResponse = response.data.choices[0].message.content;
    
    // Find the JSON object in the response
    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || 
                     aiResponse.match(/```\n([\s\S]*?)\n```/) || 
                     [null, aiResponse];
    
    const jsonStr = jsonMatch[1];
    try {
      const marketData = JSON.parse(jsonStr);
      return marketData;
    } catch (e) {
      console.error('Failed to parse OpenAI response as JSON:', jsonStr);
      return 'Error parsing OpenAI response as JSON'
    }
  } catch (error) {
    console.error('Error calling OpenAI API for market data:', error.message);
    return 'Error calling OpenAI API'
  }
}
