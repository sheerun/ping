require 'json'
require 'open-uri'
require 'resolv'

cities = JSON.parse(open('https://wonderproxy.com/serverStatus.json').read).keys

def geocode(address)
  body = open("http://api.opencagedata.com/geocode/v1/json?q=#{address}&key=#{ENV['API_KEY']}").read
  geometry = JSON.parse(body)['results'][0]['geometry']
  return geometry['lat'], geometry['lng']
end

results = cities.map do |city|
  begin
    data = open("https://wonderproxy.com/servers/#{city.gsub(/ /, '')}").read
    city, country = data.scan(/This server is located in ([^,]+).*?([^,]+?)</).first.map(&:strip)
    server = data.scan(/[a-z]*\.wonderproxy\.com/).first
    ip = Resolv.getaddress(server)
    lat, lng = geocode("#{city},#{country}")
    STDERR.puts({ city: city, country: country, server: server, ip: ip, lat: lat, lng: lng })
    { ip: ip, lat: lat, lng: lng }
  rescue
    { city: city }
  end
end

puts JSON.pretty_generate(results)
