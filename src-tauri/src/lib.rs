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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:ehpad-pilot.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
