import { useEffect } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureFulfillmentConstraintRule, unregisterFulfillmentConstraintRule } from "../utils/fulfillmentConstraints.server";
import { ensureAppLocationListMetafield } from "../utils/appMetafields.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Automatically ensure app metafield is set up on page load
  try {
    const metafieldResult = await ensureAppLocationListMetafield(admin);
    return {
      appMetafieldStatus: {
        success: true,
        isSetup: true,
        wasUpdated: metafieldResult.wasUpdated,
        locationCount: metafieldResult.locationNames.length
      }
    };
  } catch (error) {
    console.error("Failed to setup app metafield on load:", error);
    return {
      appMetafieldStatus: {
        success: false,
        isSetup: false,
        error: error.message
      }
    };
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "registerFulfillmentRule") {
    try {
      const rule = await ensureFulfillmentConstraintRule(admin);
      return {
        success: true,
        message: "Fulfillment constraint rule registered successfully",
        rule: rule,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to register fulfillment constraint rule: ${error.message}`,
        error: error.message,
      };
    }
  }

  if (action === "setupAppMetafield") {
    try {
      const result = await ensureAppLocationListMetafield(admin);
      return {
        success: true,
        message: result.wasUpdated 
          ? "App metafield updated with current store locations" 
          : "App metafield is already up to date",
        metafieldData: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to setup app metafield: ${error.message}`,
        error: error.message,
      };
    }
  }

  if (action === "unregisterFulfillmentRule") {
    try {
      const result = await unregisterFulfillmentConstraintRule(admin);
      return {
        success: true,
        message: result.message,
        unregisterData: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to unregister fulfillment constraint rule: ${error.message}`,
        error: error.message,
      };
    }
  }

  // No other actions supported
  return {
    success: false,
    message: "Unknown action",
  };
};

export default function Index() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.success === true) {
      if (fetcher.data?.unregisterData) {
        shopify.toast.show(
          fetcher.data.unregisterData.wasDeleted 
            ? "Fulfillment rule successfully unregistered" 
            : "No fulfillment rule found to unregister"
        );
      } else {
        shopify.toast.show("Operation completed successfully");
      }
    }
    if (fetcher.data?.success === false) {
      shopify.toast.show(fetcher.data.message, { isError: true });
    }
    if (fetcher.data?.metafieldData) {
      shopify.toast.show("App locations metafield setup completed");
    }
  }, [fetcher.data, shopify]);
  
  const registerFulfillmentRule = () => fetcher.submit({ action: "registerFulfillmentRule" }, { method: "POST" });
  const unregisterFulfillmentRule = () => fetcher.submit({ action: "unregisterFulfillmentRule" }, { method: "POST" });
  const setupAppMetafield = () => fetcher.submit({ action: "setupAppMetafield" }, { method: "POST" });

  return (
    <Page>
      <TitleBar title="Location Selector App" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Location Selector App 📍
                  </Text>
                  <Text variant="bodyMd" as="p">
                    This app enables customers to specify their preferred fulfillment location during checkout. 
                    The app includes a Shopify Function that applies fulfillment constraints based on customer preferences 
                    and an Admin Action extension for managing location settings on draft orders.
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Location Selector Function
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Set up the location selector function in two steps: First, click "Setup Location List" to configure available locations from your store. 
                    Then, click "Register Fulfillment Rule" to enable the constraint function that routes orders based on customer preferences.
                  </Text>
                  {loaderData?.appMetafieldStatus && (
                    <Box
                      padding="300"
                      background={loaderData.appMetafieldStatus.success ? "bg-surface-success" : "bg-surface-critical"}
                      borderWidth="025"
                      borderRadius="200"
                      borderColor={loaderData.appMetafieldStatus.success ? "border-success" : "border-critical"}
                    >
                      <Text as="p" variant="bodyMd">
                        📍 App Location List: {loaderData.appMetafieldStatus.success 
                          ? `✅ Ready (${loaderData.appMetafieldStatus.locationCount} locations${loaderData.appMetafieldStatus.wasUpdated ? ', updated on load' : ''})`
                          : `❌ Error: ${loaderData.appMetafieldStatus.error}`
                        }
                      </Text>
                    </Box>
                  )}
                </BlockStack>
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={registerFulfillmentRule}>
                    Register Fulfillment Rule
                  </Button>
                  <Button loading={isLoading} onClick={unregisterFulfillmentRule} variant="primary" tone="critical">
                    Unregister Fulfillment Rule
                  </Button>
                  <Button loading={isLoading} onClick={setupAppMetafield} variant="secondary">
                    Setup Location List
                  </Button>
                </InlineStack>
                {fetcher.data?.rule && (
                  <>
                    <Text as="h3" variant="headingMd">
                      Fulfillment Constraint Rule
                    </Text>
                    <Box
                      padding="400"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      overflowX="scroll"
                    >
                      <pre style={{ margin: 0 }}>
                        <code>
                          {JSON.stringify(fetcher.data.rule, null, 2)}
                        </code>
                      </pre>
                    </Box>
                  </>
                )}
                {fetcher.data?.unregisterData && (
                  <>
                    <Text as="h3" variant="headingMd">
                      🗑️ Unregister Fulfillment Rule Result
                    </Text>
                    <Box
                      padding="400"
                      background={fetcher.data.unregisterData.wasDeleted ? "bg-surface-success" : "bg-surface-secondary"}
                      borderWidth="025"
                      borderRadius="200"
                      borderColor={fetcher.data.unregisterData.wasDeleted ? "border-success" : "border"}
                    >
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd">
                          <strong>Status:</strong> {fetcher.data.unregisterData.wasDeleted ? "✅ Rule Deleted" : "ℹ️ No Rule Found"}
                        </Text>
                        <Text as="p" variant="bodyMd">
                          <strong>Message:</strong> {fetcher.data.unregisterData.message}
                        </Text>
                        {fetcher.data.unregisterData.deletedRuleId && (
                          <Text as="p" variant="bodyMd">
                            <strong>Deleted Rule ID:</strong> {fetcher.data.unregisterData.deletedRuleId}
                          </Text>
                        )}
                      </BlockStack>
                    </Box>
                    <Text as="h4" variant="headingSm">
                      Debug Information
                    </Text>
                    <Box
                      padding="400"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      overflowX="scroll"
                    >
                      <pre style={{ margin: 0 }}>
                        <code>
                          {JSON.stringify(fetcher.data.unregisterData, null, 2)}
                        </code>
                      </pre>
                    </Box>
                  </>
                )}
                {fetcher.data?.metafieldData && (
                  <>
                    <Text as="h3" variant="headingMd">
                      App Location List Metafield
                    </Text>
                    <Text as="p" variant="bodyMd">
                      This metafield contains the list of locations available for selection in the admin extension.
                      {fetcher.data.metafieldData.wasUpdated ? ' It was updated with current store locations.' : ' It is up to date.'}
                    </Text>
                    <BlockStack gap="200">
                      <Text as="h4" variant="headingSm">
                        Available Locations ({fetcher.data.metafieldData.locationNames.length})
                      </Text>
                      <Box
                        padding="300"
                        background="bg-surface-secondary"
                        borderWidth="025"
                        borderRadius="200"
                        borderColor="border"
                      >
                        <List>
                          {fetcher.data.metafieldData.locationNames.map((location, index) => (
                            <List.Item key={index}>{location}</List.Item>
                          ))}
                        </List>
                      </Box>
                      <Text as="h4" variant="headingSm">
                        Metafield Details
                      </Text>
                      <Box
                        padding="400"
                        background="bg-surface-active"
                        borderWidth="025"
                        borderRadius="200"
                        borderColor="border"
                        overflowX="scroll"
                      >
                        <pre style={{ margin: 0 }}>
                          <code>
                            {JSON.stringify(fetcher.data.metafieldData.metafield, null, 2)}
                          </code>
                        </pre>
                      </Box>
                    </BlockStack>
                  </>
                )}

              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    App Components
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Shopify Function
                      </Text>
                      <Text as="span" variant="bodyMd" color="subdued">
                        Fulfillment Constraints
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Admin Extension
                      </Text>
                      <Text as="span" variant="bodyMd" color="subdued">
                        Draft Order Action
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Location Storage
                      </Text>
                      <Text as="span" variant="bodyMd" color="subdued">
                        App Metafields
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Customer Preferences
                      </Text>
                      <Text as="span" variant="bodyMd" color="subdued">
                        Customer Metafields
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    How to Use
                  </Text>
                  <List>
                    <List.Item>
                      Set up location list using "Setup Location List" button
                    </List.Item>
                    <List.Item>
                      Register the fulfillment constraint rule
                    </List.Item>
                    <List.Item>
                      Use the "Select / Update Fulfillment Location" action on draft orders
                    </List.Item>
                    <List.Item>
                      Customer preferences will be applied during checkout
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
