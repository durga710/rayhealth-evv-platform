export async function up(knex) {
    await knex.schema.createTable('agencies', (table) => {
        table.uuid('id').primary();
        table.string('name').notNullable();
        table.string('state', 2).notNullable().defaultTo('PA');
        table.jsonb('operating_tracks').notNullable();
        table.string('medicaid_provider_number');
        table.timestamps(true, true);
    });
    await knex.schema.createTable('clients', (table) => {
        table.uuid('id').primary();
        table.uuid('agency_id').references('id').inTable('agencies');
        table.string('first_name').notNullable();
        table.string('last_name').notNullable();
        table.date('date_of_birth').notNullable();
        table.string('medicaid_number');
        table.timestamps(true, true);
    });
    await knex.schema.createTable('authorizations', (table) => {
        table.uuid('id').primary();
        table.uuid('client_id').references('id').inTable('clients').notNullable();
        table.string('payer_id').notNullable();
        table.decimal('units_authorized', 10, 2).notNullable();
        table.string('service_code').notNullable();
        table.date('start_date').notNullable();
        table.date('end_date').notNullable();
        table.timestamps(true, true);
    });
    await knex.schema.createTable('visit_templates', (table) => {
        table.uuid('id').primary();
        table.uuid('client_id').references('id').inTable('clients').notNullable();
        table.string('name').notNullable();
        table.jsonb('tasks').notNullable();
        table.timestamps(true, true);
    });
    await knex.schema.createTable('assignments', (table) => {
        table.uuid('id').primary();
        table.uuid('caregiver_id').notNullable(); // In real app, would reference users/staff
        table.uuid('visit_template_id').references('id').inTable('visit_templates').notNullable();
        table.timestamps(true, true);
    });
}
export async function down(knex) {
    await knex.schema.dropTableIfExists('assignments');
    await knex.schema.dropTableIfExists('visit_templates');
    await knex.schema.dropTableIfExists('authorizations');
    await knex.schema.dropTableIfExists('clients');
    await knex.schema.dropTableIfExists('agencies');
}
//# sourceMappingURL=schema.js.map