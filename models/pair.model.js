export default (mongoose)=>{
    const pairSchema = mongoose.Schema({
        "token": String,
        "pair": String
    });
    const Pair = new mongoose.model("Pair", pairSchema);
    return Pair;
}