//! Greetings for the names given on the command line.

/// The greeting for one name.
pub fn greeting(name: &str) -> String {
    format!("Hello, {name}!")
}
