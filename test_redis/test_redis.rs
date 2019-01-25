extern crate redis;
fn do_something() -> redis::RedisResult<()> {
    let client = try!(redis::Client::open("redis://127.0.0.1/"));
    let con = try!(client.get_connection());

    /* do something here */

    Ok(())
}