use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};

/// Cancellation tokens for in-flight file operations, keyed by op id.
#[derive(Default)]
pub struct OpRegistry {
    inner: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl OpRegistry {
    pub fn register(&self, op_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.inner.lock().unwrap().insert(op_id.to_string(), flag.clone());
        flag
    }

    /// Returns true when the op was known.
    pub fn cancel(&self, op_id: &str) -> bool {
        match self.inner.lock().unwrap().get(op_id) {
            Some(flag) => {
                flag.store(true, Ordering::Relaxed);
                true
            }
            None => false,
        }
    }

    pub fn unregister(&self, op_id: &str) {
        self.inner.lock().unwrap().remove(op_id);
    }
}
