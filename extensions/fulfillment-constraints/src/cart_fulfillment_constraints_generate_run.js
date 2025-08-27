// @ts-check

/**
 * @typedef {import("../generated/api").CartFulfillmentConstraintsGenerateRunInput} CartFulfillmentConstraintsGenerateRunInput
 * @typedef {import("../generated/api").CartFulfillmentConstraintsGenerateRunResult} CartFulfillmentConstraintsGenerateRunResult
 */

/**
 * @type {CartFulfillmentConstraintsGenerateRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartFulfillmentConstraintsGenerateRunInput} input
 * @returns {CartFulfillmentConstraintsGenerateRunResult}
 */
export function cartFulfillmentConstraintsGenerateRun(input) {
  // Get the desired fulfillment location from customer metafield
  const desiredLocationName = input?.cart?.buyerIdentity?.customer?.metafield?.value;
  console.error("desiredLocationName", desiredLocationName);

  // If no desired location is specified, return no changes
  if (!desiredLocationName) {
    return NO_CHANGES;
  }

  // Find the matching location by name
  const matchingLocation = input?.locations?.find(
    location => location.name === desiredLocationName
  );
  console.error("matchingLocation", matchingLocation?.id, matchingLocation?.name);

  // If no matching location is found, return no changes
  if (!matchingLocation) {
    return NO_CHANGES;
  }

  // Get all deliverable line IDs from the cart
  const deliverableLineIds = input?.cart?.deliverableLines?.map(line => line.id) ?? [];

  // If no deliverable lines, return no changes
  if (deliverableLineIds.length === 0) {
    return NO_CHANGES;
  }

  // Create the fulfillment constraint operation
  const operations = [
    {
      deliverableLinesMustFulfillFromAdd: {
        locationIds: [matchingLocation.id],
        deliverableLineIds: deliverableLineIds
      }
    }
  ];

  return {
    operations: operations
  };
};