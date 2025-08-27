/**
 * Utility functions for managing fulfillment constraint rules
 */

const FUNCTION_ID = "0198e8fa-cbe0-763d-a868-628abf38469a";

/**
 * Creates a fulfillment constraint rule for the location selector function
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<Object>} - The result of the fulfillmentConstraintRuleCreate mutation
 */
export async function createFulfillmentConstraintRule(admin) {
  console.log("Creating fulfillment constraint rule for function:", FUNCTION_ID);
  
  const mutation = `#graphql
    mutation fulfillmentConstraintRuleCreate($functionId: String!, $deliveryMethodTypes: [DeliveryMethodType!]!) {
      fulfillmentConstraintRuleCreate(functionId: $functionId, deliveryMethodTypes: $deliveryMethodTypes) {
        fulfillmentConstraintRule {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    functionId: FUNCTION_ID,
    deliveryMethodTypes: ["SHIPPING", "LOCAL", "PICK_UP"]
  };

  try {
    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();
    
    if (result.data?.fulfillmentConstraintRuleCreate?.userErrors?.length > 0) {
      console.error("Errors creating fulfillment constraint rule:", result.data.fulfillmentConstraintRuleCreate.userErrors);
      throw new Error(`Failed to create fulfillment constraint rule: ${result.data.fulfillmentConstraintRuleCreate.userErrors.map(e => e.message).join(', ')}`);
    }
    
    console.log("Successfully created fulfillment constraint rule:", result.data?.fulfillmentConstraintRuleCreate?.fulfillmentConstraintRule);
    return result.data?.fulfillmentConstraintRuleCreate?.fulfillmentConstraintRule;
  } catch (error) {
    console.error("Error creating fulfillment constraint rule:", error);
    throw error;
  }
}

/**
 * Checks if a fulfillment constraint rule already exists for our function
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<Object|null>} - The existing rule or null if not found
 */
export async function getFulfillmentConstraintRule(admin) {
  const query = `#graphql
    query fulfillmentConstraintRules($first: Int!) {
      fulfillmentConstraintRules(first: $first) {
        edges {
          node {
            id
            functionId
            enabled
            deliveryMethodTypes
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, { 
      variables: { first: 50 } 
    });
    const result = await response.json();
    
    const rules = result.data?.fulfillmentConstraintRules?.edges || [];
    const existingRule = rules.find(edge => edge.node.functionId === FUNCTION_ID);
    
    return existingRule?.node || null;
  } catch (error) {
    console.error("Error fetching fulfillment constraint rules:", error);
    return null;
  }
}

/**
 * Registers the fulfillment constraint rule if it doesn't already exist
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<Object>} - The fulfillment constraint rule (existing or newly created)
 */
export async function ensureFulfillmentConstraintRule(admin) {
  try {
    // Check if rule already exists
    const existingRule = await getFulfillmentConstraintRule(admin);
    
    if (existingRule) {
      console.log("Fulfillment constraint rule already exists:", existingRule.id);
      return existingRule;
    }
    
    // Create new rule if it doesn't exist
    console.log("No existing fulfillment constraint rule found, creating new one...");
    return await createFulfillmentConstraintRule(admin);
  } catch (error) {
    console.error("Error ensuring fulfillment constraint rule:", error);
    throw error;
  }
}
