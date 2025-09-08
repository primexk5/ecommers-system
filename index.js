const fs = require("fs").promises; 
const path = require("path");
const chalk = require("chalk");
const readLine = require("readline");
const Joi = require("joi");

const usersPath = path.join(__dirname, "users.json");
const productsPath = path.join(__dirname, "products.json");

const rl = readLine.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function readData(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    if (!data.trim()) { 
      return filePath === usersPath ? {} : [];
    }
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(chalk.yellow(`File not found, creating a new one: ${path.basename(filePath)}`));
      return filePath === usersPath ? {} : [];
    }
    console.error(`Error reading file at ${filePath}:`, error);
    return null; 
  }
}

async function writeData(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing to file at ${filePath}:`, error);
    return false;
  }
}

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}


const userSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(30)
    .required()
    .trim()
    .pattern(/^(?!\s)(?!.*\s$)[A-Za-z\s]+$/, { name: 'letters-and-spaces-no-leading-or-trailing-space' })
    .messages({
      'string.pattern.name': 'Name must only contain letters and spaces, and must not start or end with a space.',
      'string.empty': 'Name cannot be empty.',
    }),
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .trim()
    .pattern(/^(?!\s)(?!.*\s$).+$/, { name: 'no-leading-or-trailing-space' })
    .pattern(/[a-zA-Z]/, { name: 'must-contain-letter' }) // must contain at least one letter
    .messages({
      'string.pattern.name': 'Username must not start or end with a space and must contain at least one letter.',
      'string.empty': 'Username cannot be empty.',
    }),
  email: Joi.string()
    .email({ tlds: { allow: ['com', 'org', 'ng'] } })
    .required()
    .trim()
    .pattern(/^(?!\s)(?!.*\s$).+$/, { name: 'no-leading-or-trailing-space' })
    .messages({
      'string.pattern.name': 'Email must not start or end with a space.',
      'string.empty': 'Email cannot be empty.',
    }),
  password: Joi.string()
    .min(4)
    .max(6)
    .required()
    .trim()
    .pattern(/^(?!\s)(?!.*\s$).+$/, { name: 'no-leading-or-trailing-space' })
    .messages({
      'string.pattern.name': 'Password must not start or end with a space.',
      'string.empty': 'Password cannot be empty.',
    }),
});



function generateOrderId() {
  return Math.random().toString(36).substr(2, 4).toUpperCase();
}



async function registerUsers() {
  const name = await prompt("Enter your name: ");
  const username = await prompt("Enter your username: ");
  const email = await prompt("Enter your email: ");
  const password = await prompt("Enter your password: ");

  const { error, value } = userSchema.validate({ name, username, email, password });

  if (error) {
    console.log(chalk.red("Validation error:", error.details[0].message));
    return;
  }

  const users = await readData(usersPath);
  if (users === null) return; 

  if (users[username]) {
    console.log(chalk.red("Username already exists. Please choose a different username."));
    return;
  }

  users[username] = { name, email, password, admin: false, orders: [], notifications: [] };

  const success = await writeData(usersPath, users);
  if (success) {
    console.log(chalk.green("Registration successful!"));
  }
}


async function login() {
  const username = await prompt("Enter your username: ");
  const password = await prompt("Enter your password: ");

  const users = await readData(usersPath);
  if (users === null) return;

  if (users[username] && users[username].password === password) {
    console.log(chalk.green("Login successful!"));
    const currentUser = users[username];

    // Display and clear notifications
    if (currentUser.notifications && currentUser.notifications.length > 0) {
      console.log(chalk.blue("\nYou have new notifications:"));
      currentUser.notifications.forEach((note, index) => {
        console.log(chalk.yellow(`\nNotification ${index + 1}: ${note}`));
      });
      currentUser.notifications = [];
      await writeData(usersPath, users);
    } else {
      console.log(chalk.blue("No new notifications."));
    }

    while (true) {
      console.log(chalk.cyan("\nUser Menu"));
      console.log("1. See All Products");
      console.log("2. Buy Products");
      console.log("3. See bought Products");
      console.log("4. Search Products by Name");
      if (currentUser.admin) {
        console.log("5. Add Product");
        console.log("6. Edit Product");
        console.log("7. Approve Orders");
        console.log("8. See All Orders");
        console.log("9. Logout");
      } else {
        console.log("5. Logout");
      }

      const userChoice = await prompt("Enter your choice: ");

      if (currentUser.admin) {
        switch (userChoice) {
          case "1":
            await seeAllProducts();
            break;
          case "2":
            await buyProducts(username);
            break;
          case "3":
            await seeBoughtProducts(username); 
            break;
          case "4":
            await searchOrderById(username); 
            break;
          case "5":
            await addProducts();
            break;
          case "6":
            await editProduct();
            break;
          case "7":
            await approveOrders();
            break;
          case "8":
            await seeALlOders();
            break;
          case "9":
            console.log(chalk.green("Logged out successfully."));
            return;
          default:
            console.log(chalk.red("Invalid choice. Please try again."));
        }
      } else {
        switch (userChoice) {
          case "1":
            await seeAllProducts();
            break;
          case "2":
            await buyProducts(username);
            break;
          case "3":
             
            await seeBoughtProducts(username);
            
            break;
          case "4":
             await searchProducts();
            break;
          case "5":
            console.log(chalk.green("Logged out successfully."));
            return;
          default:
            console.log(chalk.red("Invalid choice. Please try again."));
        }
      }
    }
  } else {
    console.log(chalk.red("Invalid username or password."));
  }
}

// Function to see all products
async function seeAllProducts() {
  const products = await readData(productsPath);
  if (products === null) return;

  if (products.length > 0) {
    console.log(chalk.blue("All Products:"));
    products.forEach((product) => {
      console.log(chalk.yellow(`\nProduct ID: ${product.id}`));
      console.log(`Name: ${product.name}`);
      console.log(`Price: $${product.price}`);
      console.log(`Description: ${product.description}`);
      console.log(`Quantity: ${product.quantity}`); 
    });
  } else {
    console.log(chalk.red("No products available at the moment."));
  }
}

// Function to search products
async function searchProducts() {
  const searchTerm = await prompt("Enter product name to search: ");
  const products = await readData(productsPath);
  if (products === null) return;

  const results = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  if (results.length > 0) {
    console.log(chalk.blue("Search Results:"));
    results.forEach((product) => {
      console.log(chalk.yellow(`\nProduct ID: ${product.id}`));
      console.log(`Name: ${product.name}`);
      console.log(`Price: $${product.price}`);
      console.log(`Description: ${product.description}`);
      console.log(`Quantity: ${product.quantity}`); 
    });
  } else {
    console.log(chalk.red("No products found matching your search."));
  }
}

// Update buyProducts to create pending order with orderId
async function buyProducts(username) {
  const productId = await prompt("Enter the product ID to buy: ");
  const products = await readData(productsPath);
  if (products === null) return;

  const users = await readData(usersPath);
  if (users === null) return;

  const product = products.find(p => p.id === productId);

  if (!product) {
    console.log(chalk.red("Product not found."));
    return;
  }

  if (!product.quantity || product.quantity < 1) {
    console.log(chalk.red("Out of stock!"));
    return;
  }

  product.quantity -= 1;
  await writeData(productsPath, products);

  if (!users[username].orders) {
    users[username].orders = [];
  }
  const orderId = generateOrderId();
  users[username].orders.push({
    orderId,
    product,
    status: "pending"
  });
  if (!users[username].notifications) {
    users[username].notifications = [];
  }
  users[username].notifications.push(`Order ${orderId} for ${product.name} is pending admin approval.`);
  const success = await writeData(usersPath, users);
  if (success) {
    console.log(chalk.green(`Order placed! Order ID: ${orderId}. Awaiting admin approval.`));
  }
}

// Show orders with status
async function seeBoughtProducts(username) {
  const users = await readData(usersPath);
  if (users === null) return;

  const orders = users[username].orders;
  if (orders && orders.length > 0) {
    console.log(chalk.blue("Your Orders:"));
    orders.forEach((order) => {
      console.log(chalk.yellow(`\nOrder ID: ${order.orderId}`));
      console.log(`Product Name: ${order.product.name}`);
      console.log(`Price: $${order.product.price}`);
      console.log(`Description: ${order.product.description}`);
      console.log(`Status: ${order.status}`);
    });
  } else {
    console.log(chalk.red("You have not bought any products yet."));
  }
}

// Search orders by order ID
async function searchOrderById(username) {
  const orderId = await prompt("Enter Order ID to search: ");
  const users = await readData(usersPath);
  if (users === null) return;

  const orders = users[username].orders || [];
  const order = orders.find(o => o.orderId === orderId);
  if (order) {
    console.log(chalk.blue(`Order Found:`));
    console.log(`Order ID: ${order.orderId}`);
    console.log(`Product Name: ${order.product.name}`);
    console.log(`Price: $${order.product.price}`);
    console.log(`Description: ${order.product.description}`);
    console.log(`Quantity: ${order.product.quantity}`);
    console.log(`Status: ${order.status}`);
  } else {
    console.log(chalk.red("Order not found."));
  }
}

// Admin function to add products
async function addProducts() {
  const name = await prompt("Enter product name: ");
  const price = await prompt("Enter product price: ");
  const description = await prompt("Enter product description: ");

  const products = await readData(productsPath);
  if (products === null) return;

  const newProduct = {
    id: (products.length + 1).toString(),
    name,
    price: parseFloat(price),
    description,
    quantity: 3 
  };
  products.push(newProduct);

  const success = await writeData(productsPath, products);
  if (success) {
    console.log(chalk.green("Product added successfully! Default quantity set to 3."));
  }
}

// Admin: Edit product
async function editProduct() {
  const products = await readData(productsPath);
  if (products === null) return;

  const productId = await prompt("Enter the Product ID to edit: ");
  const product = products.find(p => p.id === productId);
  if (!product) {
    console.log(chalk.red("Product not found."));
    return;
  }

  const name = await prompt(`Enter new name (${product.name}): `) || product.name;
  const price = await prompt(`Enter new price (${product.price}): `) || product.price;
  const description = await prompt(`Enter new description (${product.description}): `) || product.description;

  product.name = name;
  product.price = parseFloat(price);
  product.description = description;

  const success = await writeData(productsPath, products);
  if (success) {
    console.log(chalk.green("Product updated successfully!"));
  }
}

// function to see all orders
async function seeALlOders(){
  const users = await readData(usersPath);
  if (users === null) return;

  let allOrders = [];
  for (const [username, user] of Object.entries(users)) {
    (user.orders || []).forEach(order => {
      allOrders.push({ username, order });
    });
  }

  if (allOrders.length === 0) {
    console.log(chalk.green("No orders found."));
    return;
  }

  console.log(chalk.blue("All Orders:"));
  allOrders.forEach(({ username, order }) => {
    console.log(chalk.yellow(`\nOrder ID: ${order.orderId}`));
    console.log(`User: ${username}`);
    console.log(`Product: ${order.product.name}`);
    console.log(`Price: $${order.product.price}`);
    console.log(`Status: ${order.status}`);
  });
}

// Admin  Approve orders
async function approveOrders() {
  const users = await readData(usersPath);
  if (users === null) return; 

  let pendingOrders = [];
  for (const [username, user] of Object.entries(users)) {
    (user.orders || []).forEach(order => {
      if (order.status === "pending") {
        pendingOrders.push({ username, order });
      }
    });
  }

  if (pendingOrders.length === 0) {
    console.log(chalk.green("No pending orders."));
    return;
  }

  for (const { username, order } of pendingOrders) {
    console.log(chalk.yellow(`\nOrder ID: ${order.orderId}`));
    console.log(`User: ${username}`);
    console.log(`Product: ${order.product.name}`);
    console.log(`Price: $${order.product.price}`);
    const approve = await prompt("Approve this order? (yes/no): ");
    if (approve.toLowerCase() === "yes") {
      order.status = "approved";
      if (!users[username].notifications) users[username].notifications = [];
      users[username].notifications.push(`Order ${order.orderId} for ${order.product.name} has been approved!`);
    }
  }

  await writeData(usersPath, users);
  console.log(chalk.green("Order approvals processed."));
}

// Main function
async function main() {
  while (true) {
    console.log(chalk.cyan("\nWelcome to node E-commerce System"));
    console.log("1. Register");
    console.log("2. Login");
    console.log("3. See All Products");
    console.log("4. Exit");

    const choice = await prompt("Enter your choice: ");

    switch (choice) {
      case "1":
        await registerUsers();
        break;
      case "2":
        await login();
        break;
      case "3":
        await seeAllProducts();
        break;
      case "4":
        console.log(chalk.green("Thank you for using the E-commerce System. Goodbye!"));
        rl.close();
        return;
      default:
        console.log(chalk.red("Invalid choice. Please try again."));
    }
  }
}

main();