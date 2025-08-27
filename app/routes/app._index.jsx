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
import { ensureFulfillmentConstraintRule } from "../utils/fulfillmentConstraints.server";
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

  // Original product creation logic
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  };
};

export default function Index() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
    if (fetcher.data?.success === true) {
      shopify.toast.show("Fulfillment constraint rule registered successfully");
    }
    if (fetcher.data?.success === false) {
      shopify.toast.show(fetcher.data.message, { isError: true });
    }
    if (fetcher.data?.metafieldData) {
      shopify.toast.show("App locations metafield setup completed");
    }
  }, [productId, fetcher.data, shopify]);
  
  const generateProduct = () => fetcher.submit({}, { method: "POST" });
  const registerFulfillmentRule = () => fetcher.submit({ action: "registerFulfillmentRule" }, { method: "POST" });
  const setupAppMetafield = () => fetcher.submit({ action: "setupAppMetafield" }, { method: "POST" });

  return (
    <Page>
      <TitleBar title="Remix app template">
        <button variant="primary" onClick={generateProduct}>
          Generate a product
        </button>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Congrats on creating a new Shopify app 🎉
                  </Text>
                  <Text variant="bodyMd" as="p">
                    This embedded app template uses{" "}
                    <Link
                      url="https://shopify.dev/docs/apps/tools/app-bridge"
                      target="_blank"
                      removeUnderline
                    >
                      App Bridge
                    </Link>{" "}
                    interface examples like an{" "}
                    <Link url="/app/additional" removeUnderline>
                      additional page in the app nav
                    </Link>
                    , as well as an{" "}
                    <Link
                      url="https://shopify.dev/docs/api/admin-graphql"
                      target="_blank"
                      removeUnderline
                    >
                      Admin GraphQL
                    </Link>{" "}
                    mutation demo, to provide a starting point for app
                    development.
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
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Get started with products
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Generate a product with GraphQL and get the JSON output for
                    that product. Learn more about the{" "}
                    <Link
                      url="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
                      target="_blank"
                      removeUnderline
                    >
                      productCreate
                    </Link>{" "}
                    mutation in our API references.
                  </Text>
                </BlockStack>
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={generateProduct}>
                    Generate a product
                  </Button>
                  {fetcher.data?.product && (
                    <Button
                      url={`shopify:admin/products/${productId}`}
                      target="_blank"
                      variant="plain"
                    >
                      View product
                    </Button>
                  )}
                </InlineStack>
                {fetcher.data?.product && (
                  <>
                    <Text as="h3" variant="headingMd">
                      {" "}
                      productCreate mutation
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
                          {JSON.stringify(fetcher.data.product, null, 2)}
                        </code>
                      </pre>
                    </Box>
                    <Text as="h3" variant="headingMd">
                      {" "}
                      productVariantsBulkUpdate mutation
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
                          {JSON.stringify(fetcher.data.variant, null, 2)}
                        </code>
                      </pre>
                    </Box>
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
                    App template specs
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Framework
                      </Text>
                      <Link
                        url="https://remix.run"
                        target="_blank"
                        removeUnderline
                      >
                        Remix
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Database
                      </Text>
                      <Link
                        url="https://www.prisma.io/"
                        target="_blank"
                        removeUnderline
                      >
                        Prisma
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Interface
                      </Text>
                      <span>
                        <Link
                          url="https://polaris.shopify.com"
                          target="_blank"
                          removeUnderline
                        >
                          Polaris
                        </Link>
                        {", "}
                        <Link
                          url="https://shopify.dev/docs/apps/tools/app-bridge"
                          target="_blank"
                          removeUnderline
                        >
                          App Bridge
                        </Link>
                      </span>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        API
                      </Text>
                      <Link
                        url="https://shopify.dev/docs/api/admin-graphql"
                        target="_blank"
                        removeUnderline
                      >
                        GraphQL API
                      </Link>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Next steps
                  </Text>
                  <List>
                    <List.Item>
                      Build an{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/getting-started/build-app-example"
                        target="_blank"
                        removeUnderline
                      >
                        {" "}
                        example app
                      </Link>{" "}
                      to get started
                    </List.Item>
                    <List.Item>
                      Explore Shopify’s API with{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/tools/graphiql-admin-api"
                        target="_blank"
                        removeUnderline
                      >
                        GraphiQL
                      </Link>
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
