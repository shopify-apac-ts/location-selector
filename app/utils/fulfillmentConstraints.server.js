/**
 * Utility functions for managing fulfillment constraint rules
 */

/**
 * Gets the fulfillment constraints function ID by querying shopifyFunctions
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<string>} - The function ID
 */
async function getFulfillmentConstraintsFunctionId(admin) {
  console.log("Querying shopifyFunctions to find location-selector fulfillment constraints function...");
  
  const query = `#graphql
    query shopifyFunctions($first: Int!, $apiType: String!) {
      shopifyFunctions(first: $first, apiType: $apiType) {
        edges {
          node {
            id
            apiType
            app {
              title
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, { 
      variables: { 
        first: 50,
        apiType: "fulfillment_constraints"
      } 
    });
    const result = await response.json();
    
//    console.log("shopifyFunctions query result:", JSON.stringify(result, null, 2));
    
    const functions = result.data?.shopifyFunctions?.edges || [];
    console.log("Found functions:", functions.length);
    
    // Find the function with app.title = "location-selector" and apiType = "fulfillment_constraints"
    const locationSelectorFunction = functions.find(edge => {
      const func = edge.node;
      console.log("Checking function:", {
        id: func.id,
        apiType: func.apiType,
        appTitle: func.app?.title
      });
      
      return func.app?.title === "location-selector" && func.apiType === "fulfillment_constraints";
    });
    
    if (!locationSelectorFunction) {
      console.error("Location selector fulfillment constraints function not found");
      console.log("Available functions:", functions.map(edge => ({
        id: edge.node.id,
        apiType: edge.node.apiType,
        appTitle: edge.node.app?.title
      })));
      throw new Error("Location selector fulfillment constraints function not found. Make sure the function is deployed.");
    }
    
    const functionId = locationSelectorFunction.node.id;
    console.log("Found location selector function ID:", functionId);
    
    return functionId;
  } catch (error) {
    console.error("Error fetching shopify functions:", error);
    throw error;
  }
}

/**
 * Creates a fulfillment constraint rule for the location selector function
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<Object>} - The result of the fulfillmentConstraintRuleCreate mutation
 */
export async function createFulfillmentConstraintRule(admin) {
  // Get the dynamic function ID
  const FUNCTION_ID = await getFulfillmentConstraintsFunctionId(admin);
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
  // Get the dynamic function ID
  const FUNCTION_ID = await getFulfillmentConstraintsFunctionId(admin);
  console.log("Looking for existing rule for function:", FUNCTION_ID);
  const query = `#graphql
    query fulfillmentConstraintRules {
      fulfillmentConstraintRules {
        id
        function {
          id
        }
        deliveryMethodTypes
      }
    }
  `;

  try {
    const response = await admin.graphql(query);
    const result = await response.json();
    
    const rules = result.data?.fulfillmentConstraintRules || [];
    console.log("Found existing rules:", rules.length);
    console.log("Rules details:", rules.map(rule => ({
      id: rule.id,
      functionId: rule.function.id,
      deliveryMethodTypes: rule.deliveryMethodTypes
    })));
    
    const existingRule = rules.find(rule => rule.function.id === FUNCTION_ID);
    
    if (existingRule) {
      console.log("Found existing rule:", existingRule);
    } else {
      console.log("No existing rule found for function:", FUNCTION_ID);
    }
    
    return existingRule || null;
  } catch (error) {
    console.error("Error fetching fulfillment constraint rules:", error);
    return null;
  }
}

/**
 * Deletes a fulfillment constraint rule by ID
 * @param {Object} admin - Shopify Admin API client
 * @param {string} ruleId - The ID of the rule to delete
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export async function deleteFulfillmentConstraintRule(admin, ruleId) {
  console.log("=== DELETING FULFILLMENT CONSTRAINT RULE ===");
  console.log("Rule ID to delete:", ruleId);
  
  const mutation = `#graphql
    mutation fulfillmentConstraintRuleDelete($id: ID!) {
      fulfillmentConstraintRuleDelete(id: $id) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    id: ruleId
  };

  try {
    console.log("Executing deletion mutation with variables:", variables);
    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();
    
//    console.log("Deletion mutation response:", JSON.stringify(result, null, 2));
    
    if (result.data?.fulfillmentConstraintRuleDelete?.userErrors?.length > 0) {
      const errors = result.data.fulfillmentConstraintRuleDelete.userErrors;
      console.error("Errors deleting fulfillment constraint rule:", errors);
      throw new Error(`Failed to delete fulfillment constraint rule: ${errors.map(e => e.message).join(', ')}`);
    }
    
    console.log("Successfully deleted fulfillment constraint rule:", ruleId);
    console.log("=== DELETION COMPLETED ===");
    
    return true;
  } catch (error) {
    console.error("Error deleting fulfillment constraint rule:", error);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

/**
 * Unregisters the fulfillment constraint rule if it exists
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<Object>} - Result object with success status and details
 */
export async function unregisterFulfillmentConstraintRule(admin) {
  console.log("=== UNREGISTERING FULFILLMENT CONSTRAINT RULE ===");
  
  try {
    // Check if rule exists
    const existingRule = await getFulfillmentConstraintRule(admin);
    
    if (!existingRule) {
      console.log("No fulfillment constraint rule found to unregister");
      return {
        success: true,
        message: "No fulfillment constraint rule was found to unregister",
        wasDeleted: false
      };
    }
    
    console.log("Found existing rule to delete:", existingRule.id);
    
    // Delete the rule
    await deleteFulfillmentConstraintRule(admin, existingRule.id);
    
    // Verify deletion
    const verificationRule = await getFulfillmentConstraintRule(admin);
    if (verificationRule) {
      console.error("Rule still exists after deletion attempt:", verificationRule.id);
      throw new Error("Rule deletion verification failed - rule still exists");
    }
    
    console.log("Rule deletion verified - no rule found after deletion");
    console.log("=== UNREGISTRATION COMPLETED SUCCESSFULLY ===");
    
    return {
      success: true,
      message: "Fulfillment constraint rule successfully unregistered",
      wasDeleted: true,
      deletedRuleId: existingRule.id
    };
  } catch (error) {
    console.error("Error unregistering fulfillment constraint rule:", error);
    console.error("Error stack:", error.stack);
    throw error;
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
