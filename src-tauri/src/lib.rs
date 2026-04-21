use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add phase2 tables (compliance, budget, tutelles)",
            sql: include_str!("../migrations/002_phase2.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add phase3 tables (documents, veille, anap)",
            sql: include_str!("../migrations/003_phase3.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "seed realistic test data for all modules",
            sql: include_str!("../migrations/004_seed_testdata.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "cross-module linking and alert system",
            sql: include_str!("../migrations/005_phase4.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "pilot animateur tables: activities, inventory, staff, residents, photos, sync",
            sql: include_str!("../migrations/006_animateur_tables.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "add hourly_rate and session_rate to suppliers",
            sql: include_str!("../migrations/007_staff_rates.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "category colors per module (inventory, suppliers, ...)",
            sql: include_str!("../migrations/008_category_colors.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "staff hourly/session rates + seed staff category colors",
            sql: include_str!("../migrations/009_staff_rates_and_role.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "seed activity category colors",
            sql: include_str!("../migrations/010_activity_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add is_template flag to activities",
            sql: include_str!("../migrations/011_activity_templates.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "appointments (RDV pro animateur)",
            sql: include_str!("../migrations/012_appointments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "photos: album-activity link + thumbnails",
            sql: include_str!("../migrations/013_photos_famileo.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "photo_albums: activity_type (album par type+mois)",
            sql: include_str!("../migrations/014_album_by_type.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "activities: unit column (main/pasa)",
            sql: include_str!("../migrations/015_activity_unit.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "reset activities sync_log to backfill PASA",
            sql: include_str!("../migrations/016_resync_pasa.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "activities: is_recurring + reset planning-ehpad rows",
            sql: include_str!("../migrations/017_recurring_instances.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "design v2: residents/activities/journal/projects fields + user identity seeds",
            sql: include_str!("../migrations/018_design_v2_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "animation_budget: per-category limits (default 3000 each)",
            sql: include_str!("../migrations/019_budget_category_limits.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "upcoming_expenses: planned & recurring future expenses",
            sql: include_str!("../migrations/020_upcoming_expenses.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "journal v2: title, time, author, category columns",
            sql: include_str!("../migrations/021_journal_v2_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "residents: unit column + default residence_units list",
            sql: include_str!("../migrations/022_resident_unit.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pilot-animateur.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
