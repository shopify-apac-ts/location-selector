/**
 * Utility functions for managing app metafields
 */

/**
 * Gets the current app installation ID
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<string>} - The app installation ID
 */
async function getCurrentAppInstallationId(admin) {
  const query = `#graphql
    query currentAppInstallation {
      currentAppInstallation {
        id
      }
    }
  `;

  try {
    const response = await admin.graphql(query);
    const result = await response.json();
    
    const installationId = result.data?.currentAppInstallation?.id;
    if (!installationId) {
      throw new Error("Could not get current app installation ID");
    }
    
    // Return the full GID
    return installationId;
  } catch (error) {
    console.error("Error getting app installation ID:", error);
    throw error;
  }
}

/**
 * Gets all active locations from the store
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<Array>} - Array of location objects with id and name
 */
export async function getStoreLocations(admin) {
  const query = `#graphql
    query locations($first: Int!) {
      locations(first: $first, includeInactive: false) {
        edges {
          node {
            id
            name
            isActive
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
    
    const locations = result.data?.locations?.edges || [];
    return locations
      .filter(edge => edge.node.isActive)
      .map(edge => ({
        id: edge.node.id,
        name: edge.node.name
      }));
  } catch (error) {
    console.error("Error fetching store locations:", error);
    return [];
  }
}

/**
 * Gets the app's fulfillment location list metafield
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<Object|null>} - The metafield object or null if not found
 */
export async function getAppLocationListMetafield(admin) {
  const query = `#graphql
    query appMetafields($namespace: String!, $key: String!) {
      currentAppInstallation {
        metafields(namespace: $namespace, keys: [$key], first: 1) {
          edges {
            node {
              id
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(query, {
      variables: {
        namespace: "custom",
        key: "fulfillment_location_list"
      }
    });
    const result = await response.json();
    
    const edges = result.data?.currentAppInstallation?.metafields?.edges || [];
    return edges.length > 0 ? edges[0].node : null;
  } catch (error) {
    console.error("Error fetching app metafield:", error);
    return null;
  }
}

/**
 * Creates or updates the app's fulfillment location list metafield
 * @param {Object} admin - Shopify Admin API client
 * @param {Array} locationNames - Array of location names to store
 * @returns {Promise<Object>} - The created/updated metafield
 */
export async function setAppLocationListMetafield(admin, locationNames) {
  console.log("Setting app location list metafield with locations:", locationNames);
  
  // First check if metafield already exists
  const existingMetafield = await getAppLocationListMetafield(admin);
  
  const locationListValue = JSON.stringify(locationNames);
  
  // Use metafieldsSet to create or update the metafield
  const mutation = `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
          type
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafields: [
      {
        namespace: "custom",
        key: "fulfillment_location_list",
        value: locationListValue,
        type: "json",
        ownerId: await getCurrentAppInstallationId(admin)
      }
    ]
  };

  try {
    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();
    
    if (result.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("Errors setting app metafield:", result.data.metafieldsSet.userErrors);
      throw new Error(`Failed to set app metafield: ${result.data.metafieldsSet.userErrors.map(e => e.message).join(', ')}`);
    }
    
    console.log(existingMetafield ? "Successfully updated app location list metafield" : "Successfully created app location list metafield");
    return result.data?.metafieldsSet?.metafields?.[0];
  } catch (error) {
    console.error("Error setting app metafield:", error);
    throw error;
  }
}

/**
 * Ensures the app location list metafield is set up with current store locations
 * @param {Object} admin - Shopify Admin API client
 * @returns {Promise<Object>} - The metafield and location data
 */
export async function ensureAppLocationListMetafield(admin) {
  try {
    // Get current store locations
    const storeLocations = await getStoreLocations(admin);
    console.log("Found store locations:", storeLocations);
    
    if (storeLocations.length === 0) {
      throw new Error("No active locations found in store");
    }
    
    // Extract location names
    const locationNames = storeLocations.map(loc => loc.name);
    
    // Check existing metafield
    const existingMetafield = await getAppLocationListMetafield(admin);
    
    let needsUpdate = false;
    if (!existingMetafield) {
      needsUpdate = true;
      console.log("No existing app metafield found, will create new one");
    } else {
      // Compare existing locations with current store locations
      try {
        const existingLocations = JSON.parse(existingMetafield.value);
        const existingSet = new Set(existingLocations);
        const currentSet = new Set(locationNames);
        
        // Check if locations have changed
        if (existingSet.size !== currentSet.size || 
            ![...existingSet].every(loc => currentSet.has(loc))) {
          needsUpdate = true;
          console.log("Store locations have changed, will update metafield");
          console.log("Existing locations:", existingLocations);
          console.log("Current locations:", locationNames);
        } else {
          console.log("App metafield is up to date");
        }
      } catch (parseError) {
        console.log("Error parsing existing metafield, will update:", parseError);
        needsUpdate = true;
      }
    }
    
    let metafield = existingMetafield;
    if (needsUpdate) {
      metafield = await setAppLocationListMetafield(admin, locationNames);
    }
    
    return {
      metafield,
      storeLocations,
      locationNames,
      wasUpdated: needsUpdate
    };
  } catch (error) {
    console.error("Error ensuring app location list metafield:", error);
    throw error;
  }
}
