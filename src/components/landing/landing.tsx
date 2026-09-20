import First from "./1first"
import Second from "./2Second"
import NavBar from "./NavBar"
const Landing = () => {
  return (
    <div className="flex flex-col">
      <NavBar />
      <First />
      <Second />
    </div>
  )
}
export default Landing
