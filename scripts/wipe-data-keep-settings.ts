import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Wipe all business data from the database while preserving:
 * - system_settings
 * - users
 * - roles
 * - abilities
 * - roleAbilities
 * - userRoleAssignments
 * - modules
 * - moduleActivations
 * - _prisma_migrations (automatically preserved by Prisma)
 * 
 * ⚠️ WARNING: This will permanently delete all business data!
 * Make sure you have a backup before running this script.
 */
async function main() {
  console.log('🚨 WARNING: This script will DELETE ALL BUSINESS DATA!');
  console.log('✅ It will PRESERVE: Settings, Users, Roles, Abilities, Modules');
  console.log('❌ It will DELETE: All other data (leads, accounts, products, invoices, etc.)');
  console.log('');
  
  // In production, you might want to add a confirmation prompt here
  // For now, we'll proceed (you can add confirmation logic if needed)
  
  try {
    console.log('🗑️  Starting data wipe...\n');

    // Disable foreign key checks temporarily (PostgreSQL)
    // Note: Prisma doesn't support disabling FK checks directly
    // We'll delete in the correct order to avoid FK violations

    // Step 1: Delete all dependent records first (in reverse dependency order)
    console.log('📋 Step 1: Deleting dependent records...');
    
    // Delete task-related records
    await prisma.taskChecklistItem.deleteMany({});
    await prisma.taskComment.deleteMany({});
    await prisma.taskAttachment.deleteMany({});
    await prisma.taskAssignee.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.recurringTask.deleteMany({});
    await prisma.taskTemplate.deleteMany({});
    await prisma.taskCategory.deleteMany({});
    console.log('✅ Deleted task-related records');

    // Delete communication records
    await prisma.emailMessage.deleteMany({});
    await prisma.smsMessage.deleteMany({});
    await prisma.emailCampaign.deleteMany({});
    await prisma.smsCampaign.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.communicationLog.deleteMany({});
    await prisma.template.deleteMany({});
    console.log('✅ Deleted communication records');

    // Delete ecommerce records
    await prisma.ecommerceOrderItem.deleteMany({});
    await prisma.ecommerceOrder.deleteMany({});
    await prisma.ecommerceCustomer.deleteMany({});
    await prisma.abandonedCartItem.deleteMany({});
    await prisma.abandonedCart.deleteMany({});
    await prisma.bestDealProduct.deleteMany({});
    await prisma.bestDeal.deleteMany({});
    console.log('✅ Deleted ecommerce records');

    // Delete sales records
    await prisma.payment.deleteMany({});
    await prisma.creditNoteLine.deleteMany({});
    await prisma.creditNote.deleteMany({});
    await prisma.returnLine.deleteMany({});
    await prisma.return.deleteMany({});
    await prisma.invoiceLine.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.proformaLine.deleteMany({});
    await prisma.proforma.deleteMany({});
    await prisma.quotationLine.deleteMany({});
    await prisma.quotation.deleteMany({});
    await prisma.salesOrderLine.deleteMany({});
    await prisma.salesOrder.deleteMany({});
    await prisma.orderLine.deleteMany({});
    await prisma.order.deleteMany({});
    console.log('✅ Deleted sales records');

    // Delete delivery and route records
    await prisma.delivery.deleteMany({});
    await prisma.route.deleteMany({});
    console.log('✅ Deleted delivery and route records');

    // Delete commission records
    await prisma.commission.deleteMany({});
    await prisma.agent.deleteMany({});
    console.log('✅ Deleted commission records');

    // Delete DRM records
    await prisma.distributorLead.deleteMany({});
    await prisma.distributor.deleteMany({});
    console.log('✅ Deleted DRM records');

    // Delete CRM records
    await prisma.opportunity.deleteMany({});
    await prisma.contact.deleteMany({});
    await prisma.accountAddress.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.leadSource.deleteMany({});
    console.log('✅ Deleted CRM records');

    // Delete inventory records
    await prisma.stocktakeItem.deleteMany({});
    await prisma.stocktakeSession.deleteMany({});
    await prisma.stockMovement.deleteMany({});
    await prisma.stockItem.deleteMany({});
    await prisma.backorder.deleteMany({});
    await prisma.warehouse.deleteMany({});
    console.log('✅ Deleted inventory records');

    // Delete product-related records
    await prisma.productImage.deleteMany({});
    await prisma.productAttributeValue.deleteMany({});
    await prisma.productSupplier.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.priceList.deleteMany({});
    await prisma.unitOfMeasure.deleteMany({});
    console.log('✅ Deleted product-related records');

    // Delete project records
    await prisma.projectMember.deleteMany({});
    await prisma.projectStage.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.incidentActivity.deleteMany({});
    await prisma.incident.deleteMany({});
    await prisma.resourceRequest.deleteMany({});
    console.log('✅ Deleted project records');

    // Delete exchange rates
    await prisma.exchangeRate.deleteMany({});
    console.log('✅ Deleted exchange rates');

    // Delete currencies (but we might want to keep these - comment out if needed)
    // await prisma.currency.deleteMany({});
    // console.log('✅ Deleted currencies');

    // Step 2: Verify what was preserved
    console.log('\n📊 Step 2: Verifying preserved data...');
    
    const settingsCount = await prisma.systemSettings.count();
    const usersCount = await prisma.user.count();
    const rolesCount = await prisma.role.count();
    const abilitiesCount = await prisma.ability.count();
    const modulesCount = await prisma.module.count();

    console.log(`✅ Preserved ${settingsCount} system settings`);
    console.log(`✅ Preserved ${usersCount} users`);
    console.log(`✅ Preserved ${rolesCount} roles`);
    console.log(`✅ Preserved ${abilitiesCount} abilities`);
    console.log(`✅ Preserved ${modulesCount} modules`);

    // Step 3: Summary
    console.log('\n🎉 Data wipe completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('✅ All business data has been deleted');
    console.log('✅ Settings, users, roles, and abilities have been preserved');
    console.log('✅ Your system is ready for fresh data');
    console.log('');
    console.log('⚠️  Remember: This action cannot be undone!');
    console.log('💡 If you need to restore data, use a backup created before running this script.');

  } catch (error) {
    console.error('❌ Error during data wipe:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

