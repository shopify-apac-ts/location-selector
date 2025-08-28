import {useEffect, useState} from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
  Select,
  Banner,
} from '@shopify/ui-extensions-react/admin';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.draft-order-details.action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  // The useApi hook provides access to several useful APIs like i18n, close, and data.
  const {i18n, close, data, query} = useApi(TARGET);
  console.log('Draft order data:', data);
  
  const [draftOrder, setDraftOrder] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [locationOptions, setLocationOptions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Use direct API calls to fetch data from Shopify.
  useEffect(() => {
    (async function getDraftOrderInfo() {
      try {
        setLoading(true);
        setError('');

        const getDraftOrderQuery = `
          query DraftOrder($id: ID!) {
            draftOrder(id: $id) {
              id
              name
              customer {
                id
                email
                displayName
                metafield(namespace: "custom", key: "fulfillment_location") {
                  id
                  value
                }
              }
              metafield(namespace: "custom", key: "fulfillment_location") {
                id
                value
              }
            }
          }
        `;

        const getAppMetafieldQuery = `
          query AppMetafield {
            currentAppInstallation {
              metafields(first: 10) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        `;

        console.log('Querying draft order with ID:', data.selected[0].id);
        
        // First, get draft order data
        let draftOrderResult;
        try {
          draftOrderResult = await query(getDraftOrderQuery, {
            variables: {id: data.selected[0].id},
          });
          console.log('Draft order result from query API:', draftOrderResult);
        } catch (queryError) {
          console.log('Query API failed for draft order, trying fetch method:', queryError);
          
          // Fallback to fetch method
          const res = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            body: JSON.stringify({
              query: getDraftOrderQuery,
              variables: {id: data.selected[0].id}
            }),
          });

          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          draftOrderResult = await res.json();
          console.log('Draft order result from fetch:', draftOrderResult);
        }

        if (draftOrderResult.errors) {
          console.error('GraphQL errors for draft order:', draftOrderResult.errors);
          setError(`GraphQL Error: ${draftOrderResult.errors.map(e => e.message).join(', ')}`);
          return;
        }

        // Then, get app metafield data
        let appMetafieldResult;
        try {
          appMetafieldResult = await query(getAppMetafieldQuery);
          console.log('App metafield result from query API:', appMetafieldResult);
        } catch (queryError) {
          console.log('Query API failed for app metafield, trying fetch method:', queryError);
          
          // Fallback to fetch method
          const res = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            body: JSON.stringify({
              query: getAppMetafieldQuery
            }),
          });

          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          appMetafieldResult = await res.json();
          console.log('App metafield result from fetch:', appMetafieldResult);
        }

        if (appMetafieldResult.errors) {
          console.error('GraphQL errors for app metafield:', appMetafieldResult.errors);
          // Don't return here, just log the error as app metafield is optional
        }

        const draftOrderData = draftOrderResult.data?.draftOrder;
        if (!draftOrderData) {
          console.error('No draft order data returned:', draftOrderResult);
          setError('Draft order not found or access denied');
          return;
        }

        setDraftOrder(draftOrderData);

        // Debug existing metafield values
        console.log('=== EXISTING METAFIELD VALUES ===');
        console.log('Customer metafield:', {
          id: draftOrderData.customer?.metafield?.id,
          value: draftOrderData.customer?.metafield?.value
        });
        console.log('Draft order metafield:', {
          id: draftOrderData?.metafield?.id,
          value: draftOrderData?.metafield?.value
        });

        // Check if customer is attached
        if (!draftOrderData.customer) {
          setError('No customer is attached to this draft order. Please assign a customer first.');
          return;
        }

        setCustomer(draftOrderData.customer);

        // Get available locations from the app metafield
        const appMetafieldEdges = appMetafieldResult.data?.currentAppInstallation?.metafields?.edges || [];
        const fulfillmentLocationMetafield = appMetafieldEdges.find(edge => 
          edge.node.namespace === "custom" && edge.node.key === "fulfillment_location_list"
        );
        const appMetafieldValue = fulfillmentLocationMetafield?.node.value || null;
        
        console.log('App metafield value:', appMetafieldValue);
        
        let locations = [];
        
        // Get locations from app metafield
        if (appMetafieldValue) {
          try {
            let locationNames = [];
            
            if (appMetafieldValue.startsWith('[') || appMetafieldValue.startsWith('{')) {
              // Parse as JSON
              const parsed = JSON.parse(appMetafieldValue);
              if (Array.isArray(parsed)) {
                locationNames = parsed;
              } else if (parsed.locations && Array.isArray(parsed.locations)) {
                locationNames = parsed.locations;
              }
            } else if (appMetafieldValue.includes(',')) {
              // Parse as comma-separated
              locationNames = appMetafieldValue.split(',').map(name => name.trim()).filter(name => name !== '');
            } else {
              // Single location
              locationNames = [appMetafieldValue.trim()];
            }
            
            console.log('Location names from app metafield:', locationNames);
            
            // Create location options from the names
            locations = locationNames.map(name => ({
              label: name,
              value: name
            }));
            
            console.log('Processed location options:', locations);
            
          } catch (parseError) {
            console.error('Error parsing app metafield:', parseError);
            locations = [];
          }
        }
        
        console.log('Final location options:', locations);
        
        // Provide fallback locations if no app metafield locations found
        let finalLocationOptions = locations;
        if (locations.length === 0) {
          console.log('No app metafield found, providing setup instructions and fallback options');
          setError('App metafield not found. Please go to the app settings and click "Setup Location List" to configure available fulfillment locations.');
          
          // Provide some example locations as fallback
          finalLocationOptions = [
            { label: 'Main Warehouse', value: 'Main Warehouse' },
            { label: 'Store Location', value: 'Store Location' },
            { label: 'Distribution Center', value: 'Distribution Center' }
          ];
          
          console.log('Using fallback locations:', finalLocationOptions);
        }
        
        setLocationOptions(finalLocationOptions);
        
        // Set current customer's fulfillment location as selected if it exists
        const currentCustomerLocation = draftOrderData.customer?.metafield?.value;
        console.log('Current customer location:', currentCustomerLocation);
        
        if (currentCustomerLocation && finalLocationOptions.some(loc => loc.value === currentCustomerLocation)) {
          setSelectedLocation(currentCustomerLocation);
          console.log('Pre-selected customer location:', currentCustomerLocation);
        }
      } catch (err) {
        console.error('Error fetching draft order:', err);
        setError('Failed to load draft order information');
      } finally {
        setLoading(false);
      }
    })();
  }, [data.selected, query]);

  const handleSave = async () => {
    console.log('=== SAVE OPERATION STARTED ===');
    console.log('Selected location:', selectedLocation);
    console.log('Customer:', customer);
    console.log('Draft order:', draftOrder);
    
    if (!selectedLocation || !customer) {
      console.error('Missing required data for save:', { selectedLocation, customer });
      return;
    }

    try {
      setSaving(true);
      console.log('Setting saving state to true');
      
      // Update both customer and draft order metafields with selected location
      const updateMetafieldsMutation = `
        mutation updateMetafields($customerInput: CustomerInput!, $draftOrderId: ID!, $draftOrderInput: DraftOrderInput!) {
          customerUpdate(input: $customerInput) {
            customer {
              id
              metafield(namespace: "custom", key: "fulfillment_location") {
                id
                value
              }
            }
            userErrors {
              field
              message
            }
          }
          draftOrderUpdate(id: $draftOrderId, input: $draftOrderInput) {
            draftOrder {
              id
              metafield(namespace: "custom", key: "fulfillment_location") {
                id
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      // Prepare customer metafield - include ID if it exists (for updates)
      const customerMetafield = {
        namespace: "custom",
        key: "fulfillment_location",
        value: selectedLocation,
        type: "single_line_text_field"
      };
      
      // If customer already has this metafield, include the ID for update
      if (customer.metafield?.id) {
        customerMetafield.id = customer.metafield.id;
        console.log('Customer has existing metafield, including ID for update:', customer.metafield.id);
      } else {
        console.log('Customer has no existing metafield, creating new one');
      }
      
      // Prepare draft order metafield - include ID if it exists (for updates)  
      const draftOrderMetafield = {
        namespace: "custom",
        key: "fulfillment_location",
        value: selectedLocation,
        type: "single_line_text_field"
      };
      
      // If draft order already has this metafield, include the ID for update
      if (draftOrder.metafield?.id) {
        draftOrderMetafield.id = draftOrder.metafield.id;
        console.log('Draft order has existing metafield, including ID for update:', draftOrder.metafield.id);
      } else {
        console.log('Draft order has no existing metafield, creating new one');
      }

      const mutationVariables = {
        customerInput: {
          id: customer.id,
          metafields: [customerMetafield]
        },
        draftOrderId: draftOrder.id,
        draftOrderInput: {
          metafields: [draftOrderMetafield]
        }
      };

      console.log('GraphQL mutation:', updateMetafieldsMutation);
      console.log('Mutation variables:', JSON.stringify(mutationVariables, null, 2));

      let result;
      try {
        console.log('Attempting query API call...');
        result = await query(updateMetafieldsMutation, {
          variables: mutationVariables
        });
        console.log('Query API call successful, result:', result);
      } catch (queryError) {
        console.log('Query API failed for mutation, trying fetch method:', queryError);
        
        console.log('Attempting fetch API call...');
        const res = await fetch("shopify:admin/api/graphql.json", {
          method: "POST",
          body: JSON.stringify({
            query: updateMetafieldsMutation,
            variables: mutationVariables
          }),
        });

        console.log('Fetch response status:', res.status, res.statusText);
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        result = await res.json();
        console.log('Fetch API call successful, result:', result);
      }

      // Check for errors in both customer and draft order updates
      console.log('=== ANALYZING MUTATION RESULTS ===');
//      console.log('Full result object:', JSON.stringify(result, null, 2));
      
      const customerErrors = result.data?.customerUpdate?.userErrors || [];
      const draftOrderErrors = result.data?.draftOrderUpdate?.userErrors || [];
      const allErrors = [...customerErrors, ...draftOrderErrors];

      console.log('Customer update errors:', customerErrors);
      console.log('Draft order update errors:', draftOrderErrors);
      console.log('GraphQL errors:', result.errors);

      // Log the actual results
      if (result.data?.customerUpdate?.customer) {
        console.log('Customer update successful:', result.data.customerUpdate.customer);
        console.log('Customer metafield value:', result.data.customerUpdate.customer.metafield?.value);
      } else {
        console.log('Customer update failed or no customer returned');
      }

      if (result.data?.draftOrderUpdate?.draftOrder) {
        console.log('Draft order update successful:', result.data.draftOrderUpdate.draftOrder);
        console.log('Draft order metafield value:', result.data.draftOrderUpdate.draftOrder.metafield?.value);
      } else {
        console.log('Draft order update failed or no draft order returned');
      }

      if (result.errors || allErrors.length > 0) {
        const errors = result.errors || allErrors;
        console.error('Error updating metafields:', errors);
        setError(`Failed to save location: ${errors.map(e => e.message).join(', ')}`);
        return;
      }

      console.log('=== SAVE OPERATION COMPLETED SUCCESSFULLY ===');
      console.log('Selected location saved:', selectedLocation);
      close();
    } catch (err) {
      console.error('=== SAVE OPERATION FAILED ===');
      console.error('Error details:', err);
      console.error('Error stack:', err.stack);
      setError('Failed to save fulfillment location');
    } finally {
      console.log('Setting saving state to false');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminAction title="Select Fulfillment Location">
        <BlockStack>
          <Text>Loading draft order information...</Text>
        </BlockStack>
      </AdminAction>
    );
  }

  return (
    <AdminAction
      title="Select Fulfillment Location"
      primaryAction={
        <Button
          onPress={handleSave}
          disabled={!selectedLocation || saving || !!error}
          loading={saving}
        >
          Save
        </Button>
      }
      secondaryAction={
        <Button
          onPress={() => {
            console.log('Location selection cancelled');
            close();
          }}
        >
          Cancel
        </Button>
      }
    >
      <BlockStack>
        {error && (
          <Banner tone="critical">
            {error}
          </Banner>
        )}
        
        {!error && draftOrder && (
          <>
            <Text fontWeight="bold">Draft Order: {draftOrder.name}</Text>
            {customer && (
              <Text>Customer: {customer.displayName} ({customer.email})</Text>
            )}
            
            {locationOptions.length > 0 && (
              <>
                <Text fontWeight="bold">Select Fulfillment Location:</Text>
                <Select
                  label="Fulfillment Location"
                  value={selectedLocation}
                  onChange={setSelectedLocation}
                  options={[
                    {label: 'Select a location...', value: ''},
                    ...locationOptions
                  ]}
                />
                {customer?.metafield?.value && (
                  <Text tone="subdued">
                    Current customer location: {customer.metafield.value}
                  </Text>
                )}
              </>
            )}
          </>
        )}
      </BlockStack>
    </AdminAction>
  );
}