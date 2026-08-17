mod health;
mod jobs;
mod nodes;

use axum::Router;

use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .merge(health::router())
        .nest(
            "/api/v1",
            Router::new()
                .merge(nodes::router())
                .merge(jobs::router())
                .with_state(state),
        )
}
