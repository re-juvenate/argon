import First from "./1first"
import Second from "./2Second"
import Third from "./3Third"
import Fourth from "./4Fourth"
import Fifth from "./5Fifth"
import NavBar from "./NavBar"
import Footer from "./footer"

const Landing = () => {
  return (
    <div className="flex flex-col w-full min-h-screen overflow-x-hidden bg-black text-white">
      <NavBar />
      <First />
      <Second />
      <Third />
      <Fourth />
      <Fifth />
      <Footer />
    </div>
  )
}
export default Landing
