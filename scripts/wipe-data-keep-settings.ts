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

// Helper function to safely delete with error handling
async function safeDelete(operation: () => Promise<any>, modelName: string): Promise<void> {
  try {
    await operation();
  } catch (error: any) {
    // If model doesn't exist or table is empty, that's okay
    if (error?.code === 'P2025' || error?.message?.includes('does not exist')) {
      console.log(`⚠️  ${modelName}: Table doesn't exist or is already empty (skipping)`);
    } else {
      console.error(`❌ Error deleting ${modelName}:`, error.message);
      throw error;
    }
  }
}

async function main() {
  console.log('🚨 WARNING: This script will DELETE ALL BUSINESS DATA!');
  console.log('✅ It will PRESERVE: Settings, Users, Roles, Abilities, Modules');
  console.log('❌ It will DELETE: All other data (leads, accounts, products, invoices, etc.)');
  console.log('');
  
  try {
    console.log('🗑️  Starting data wipe...\n');

    // Step 1: Delete all dependent records first (in reverse dependency order)
    console.log('📋 Step 1: Deleting dependent records...');
    
    // Delete task-related records
    await safeDelete(() => prisma.taskChecklistItem.deleteMany({}), 'TaskChecklistItem');
    await safeDelete(() => prisma.taskComment.deleteMany({}), 'TaskComment');
    await safeDelete(() => prisma.taskAttachment.deleteMany({}), 'TaskAttachment');
    await safeDelete(() => prisma.taskAssignee.deleteMany({}), 'TaskAssignee');
    await safeDelete(() => prisma.taskDependency.deleteMany({}), 'TaskDependency');
    await safeDelete(() => prisma.taskTemplateItem.deleteMany({}), 'TaskTemplateItem');
    await safeDelete(() => prisma.task.deleteMany({}), 'Task');
    await safeDelete(() => prisma.recurringTask.deleteMany({}), 'RecurringTask');
    await safeDelete(() => prisma.taskTemplate.deleteMany({}), 'TaskTemplate');
    await safeDelete(() => prisma.taskCategory.deleteMany({}), 'TaskCategory');
    console.log('✅ Deleted task-related records');

    // Delete communication records
    await safeDelete(() => prisma.emailMessage.deleteMany({}), 'EmailMessage');
    await safeDelete(() => prisma.smsMessage.deleteMany({}), 'SmsMessage');
    await safeDelete(() => prisma.emailCampaign.deleteMany({}), 'EmailCampaign');
    await safeDelete(() => prisma.smsCampaign.deleteMany({}), 'SmsCampaign');
    await safeDelete(() => prisma.notification.deleteMany({}), 'Notification');
    await safeDelete(() => prisma.notificationTemplate.deleteMany({}), 'NotificationTemplate');
    console.log('✅ Deleted communication records');

    // Delete ecommerce records
    await safeDelete(() => prisma.ecommerceOrderItem.deleteMany({}), 'EcommerceOrderItem');
    await safeDelete(() => prisma.ecommerceOrder.deleteMany({}), 'EcommerceOrder');
    await safeDelete(() => prisma.customerAddress.deleteMany({}), 'CustomerAddress');
    await safeDelete(() => prisma.customer.deleteMany({}), 'Customer');
    await safeDelete(() => prisma.abandonedCart.deleteMany({}), 'AbandonedCart');
    await safeDelete(() => prisma.storefrontTestimonial.deleteMany({}), 'StorefrontTestimonial');
    await safeDelete(() => prisma.storefrontContent.deleteMany({}), 'StorefrontContent');
    await safeDelete(() => prisma.banner.deleteMany({}), 'Banner');
    await safeDelete(() => prisma.newsletterSubscription.deleteMany({}), 'NewsletterSubscription');
    console.log('✅ Deleted ecommerce records');

    // Delete sales records
    await safeDelete(() => prisma.paymentAllocation.deleteMany({}), 'PaymentAllocation');
    await safeDelete(() => prisma.payment.deleteMany({}), 'Payment');
    await safeDelete(() => prisma.creditNoteApplication.deleteMany({}), 'CreditNoteApplication');
    await safeDelete(() => prisma.creditNote.deleteMany({}), 'CreditNote');
    await safeDelete(() => prisma.returnLine.deleteMany({}), 'ReturnLine');
    await safeDelete(() => prisma.return.deleteMany({}), 'Return');
    await safeDelete(() => prisma.invoiceLine.deleteMany({}), 'InvoiceLine');
    await safeDelete(() => prisma.invoice.deleteMany({}), 'Invoice');
    await safeDelete(() => prisma.proformaLine.deleteMany({}), 'ProformaLine');
    await safeDelete(() => prisma.proforma.deleteMany({}), 'Proforma');
    await safeDelete(() => prisma.quotationLine.deleteMany({}), 'QuotationLine');
    await safeDelete(() => prisma.quotation.deleteMany({}), 'Quotation');
    await safeDelete(() => prisma.salesOrderLine.deleteMany({}), 'SalesOrderLine');
    await safeDelete(() => prisma.salesOrder.deleteMany({}), 'SalesOrder');
    await safeDelete(() => prisma.orderItem.deleteMany({}), 'OrderItem');
    await safeDelete(() => prisma.order.deleteMany({}), 'Order');
    console.log('✅ Deleted sales records');

    // Delete delivery and route records
    await safeDelete(() => prisma.delivery.deleteMany({}), 'Delivery');
    await safeDelete(() => prisma.route.deleteMany({}), 'Route');
    await safeDelete(() => prisma.driver.deleteMany({}), 'Driver');
    await safeDelete(() => prisma.zone.deleteMany({}), 'Zone');
    console.log('✅ Deleted delivery and route records');

    // Delete commission records
    await safeDelete(() => prisma.commissionAudit.deleteMany({}), 'CommissionAudit');
    await safeDelete(() => prisma.agentInvoice.deleteMany({}), 'AgentInvoice');
    await safeDelete(() => prisma.commissionRule.deleteMany({}), 'CommissionRule');
    await safeDelete(() => prisma.commission.deleteMany({}), 'Commission');
    await safeDelete(() => prisma.agent.deleteMany({}), 'Agent');
    console.log('✅ Deleted commission records');

    // Delete DRM records
    await safeDelete(() => prisma.distributorLeadProduct.deleteMany({}), 'DistributorLeadProduct');
    await safeDelete(() => prisma.distributorLeadEmail.deleteMany({}), 'DistributorLeadEmail');
    await safeDelete(() => prisma.distributorLeadSMS.deleteMany({}), 'DistributorLeadSMS');
    await safeDelete(() => prisma.distributorLeadImage.deleteMany({}), 'DistributorLeadImage');
    await safeDelete(() => prisma.distributorLead.deleteMany({}), 'DistributorLead');
    await safeDelete(() => prisma.distributorProduct.deleteMany({}), 'DistributorProduct');
    await safeDelete(() => prisma.distributorEmail.deleteMany({}), 'DistributorEmail');
    await safeDelete(() => prisma.distributorSMS.deleteMany({}), 'DistributorSMS');
    await safeDelete(() => prisma.distributorImage.deleteMany({}), 'DistributorImage');
    await safeDelete(() => prisma.distributorCreditHistory.deleteMany({}), 'DistributorCreditHistory');
    await safeDelete(() => prisma.distributor.deleteMany({}), 'Distributor');
    console.log('✅ Deleted DRM records');

    // Delete CRM records
    await safeDelete(() => prisma.leadMeeting.deleteMany({}), 'LeadMeeting');
    await safeDelete(() => prisma.leadProduct.deleteMany({}), 'LeadProduct');
    await safeDelete(() => prisma.leadSMS.deleteMany({}), 'LeadSMS');
    await safeDelete(() => prisma.leadEmail.deleteMany({}), 'LeadEmail');
    await safeDelete(() => prisma.leadFile.deleteMany({}), 'LeadFile');
    await safeDelete(() => prisma.leadComment.deleteMany({}), 'LeadComment');
    await safeDelete(() => prisma.opportunity.deleteMany({}), 'Opportunity');
    await safeDelete(() => prisma.contact.deleteMany({}), 'Contact');
    await safeDelete(() => prisma.accountAddress.deleteMany({}), 'AccountAddress');
    await safeDelete(() => prisma.account.deleteMany({}), 'Account');
    await safeDelete(() => prisma.lead.deleteMany({}), 'Lead');
    await safeDelete(() => prisma.leadSource.deleteMany({}), 'LeadSource');
    console.log('✅ Deleted CRM records');

    // Delete inventory records
    await safeDelete(() => prisma.stocktakeItem.deleteMany({}), 'StocktakeItem');
    await safeDelete(() => prisma.stocktakeSession.deleteMany({}), 'StocktakeSession');
    await safeDelete(() => prisma.stockMovement.deleteMany({}), 'StockMovement');
    await safeDelete(() => prisma.stockItem.deleteMany({}), 'StockItem');
    await safeDelete(() => prisma.backorder.deleteMany({}), 'Backorder');
    await safeDelete(() => prisma.warehouse.deleteMany({}), 'Warehouse');
    console.log('✅ Deleted inventory records');

    // Delete product-related records
    await safeDelete(() => prisma.productBarcode.deleteMany({}), 'ProductBarcode');
    await safeDelete(() => prisma.productSupplier.deleteMany({}), 'ProductSupplier');
    await safeDelete(() => prisma.productDocument.deleteMany({}), 'ProductDocument');
    await safeDelete(() => prisma.productImage.deleteMany({}), 'ProductImage');
    await safeDelete(() => prisma.priceListItem.deleteMany({}), 'PriceListItem');
    await safeDelete(() => prisma.priceList.deleteMany({}), 'PriceList');
    await safeDelete(() => prisma.ecommerceCategoryConfig.deleteMany({}), 'EcommerceCategoryConfig');
    await safeDelete(() => prisma.category.deleteMany({}), 'Category');
    await safeDelete(() => prisma.product.deleteMany({}), 'Product');
    await safeDelete(() => prisma.unitOfMeasure.deleteMany({}), 'UnitOfMeasure');
    console.log('✅ Deleted product-related records');

    // Delete project records
    await safeDelete(() => prisma.projectDocument.deleteMany({}), 'ProjectDocument');
    await safeDelete(() => prisma.dailyReportImage.deleteMany({}), 'DailyReportImage');
    await safeDelete(() => prisma.dailyReport.deleteMany({}), 'DailyReport');
    await safeDelete(() => prisma.resourceRequestEvent.deleteMany({}), 'ResourceRequestEvent');
    await safeDelete(() => prisma.resourceRequestComment.deleteMany({}), 'ResourceRequestComment');
    await safeDelete(() => prisma.resourceRequestItem.deleteMany({}), 'ResourceRequestItem');
    await safeDelete(() => prisma.resourceRequest.deleteMany({}), 'ResourceRequest');
    await safeDelete(() => prisma.incidentActivity.deleteMany({}), 'IncidentActivity');
    await safeDelete(() => prisma.incident.deleteMany({}), 'Incident');
    await safeDelete(() => prisma.projectStage.deleteMany({}), 'ProjectStage');
    await safeDelete(() => prisma.projectMember.deleteMany({}), 'ProjectMember');
    await safeDelete(() => prisma.project.deleteMany({}), 'Project');
    console.log('✅ Deleted project records');

    // Delete AI chat records
    await safeDelete(() => prisma.aiChatConversation.deleteMany({}), 'AiChatConversation');
    console.log('✅ Deleted AI chat records');

    // Delete activity records
    await safeDelete(() => prisma.activity.deleteMany({}), 'Activity');
    console.log('✅ Deleted activity records');

    // Delete audit logs (optional - comment out if you want to keep audit history)
    await safeDelete(() => prisma.auditLog.deleteMany({}), 'AuditLog');
    console.log('✅ Deleted audit logs');

    // Delete exchange rates
    await safeDelete(() => prisma.exchangeRate.deleteMany({}), 'ExchangeRate');
    console.log('✅ Deleted exchange rates');

    // Delete currencies (but we might want to keep these - comment out if needed)
    // await safeDelete(() => prisma.currency.deleteMany({}), 'Currency');
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
