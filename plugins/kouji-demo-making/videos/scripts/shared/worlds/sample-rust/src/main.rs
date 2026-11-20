fn main() {
    let names: Vec<String> = std::env::args().skip(1).collect();
    if names.is_empty() {
        eprintln!("usage: greet <name>...");
        std::process::exit(2);
    }
    for name in &names {
        println!("{}", greet::greeting(name));
    }
}
