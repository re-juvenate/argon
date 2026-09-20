import { RouterProvider, createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router'
import Layout from "./components/dash/Layout"
import Landing from "./components/landing/landing"

// Define the root route
const rootRoute = createRootRoute({
  component: () => <Outlet />
})

// Define the index route (/)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
})

// Define the /graph route
const graphRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/graph',
  component: () => (
    <div className="bg-background h-screen w-screen overflow-hidden">
      <Layout />
      {/*<ColorButton />*/}
    </div>
  ),
})

// Create the route tree
const routeTree = rootRoute.addChildren([indexRoute, graphRoute])

// Create the router
const router = createRouter({ routeTree })

// Register your router for maximum type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const App = () => {
  return <RouterProvider router={router} />
}

export default App
