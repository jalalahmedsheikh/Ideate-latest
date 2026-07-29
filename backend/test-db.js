async function testEndpoints() {
  try {
    console.log("Hitting backend profile endpoint...");
    const res = await fetch("http://localhost:8000/user/profile/677847e912c2ac4d31860a7c");
    const data = await res.json();
    console.log("Profile response status:", res.status, "body:", data);
  } catch (err) {
    console.error("Profile error:", err.message);
  }

  try {
    console.log("Hitting backend posts endpoint...");
    const res = await fetch("http://localhost:8000/post/userpost/all/677847e912c2ac4d31860a7c");
    const data = await res.json();
    console.log("Posts response status:", res.status, "body:", data);
  } catch (err) {
    console.error("Posts error:", err.message);
  }
}

testEndpoints();
