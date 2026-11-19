Pod::Spec.new do |s|
 s.name = 'PhoneappCalling'
 s.version = '0.1.0'
 s.summary = 'Phoneapp native device identity and incoming calls'
 s.author = 'BA Web Tech'
 s.homepage = 'https://github.com/cnm4us/phoneapp'
 s.license = { :type => 'Proprietary' }
 s.platforms = { :ios => '16.4' }
 s.source = { :git => 'https://github.com/cnm4us/phoneapp.git' }
 s.static_framework = true
 s.dependency 'ExpoModulesCore'
 s.dependency 'JitsiWebRTC', '~> 155.0.0'
 s.dependency 'React-Core'
 s.swift_version = '5.0'
 s.frameworks = 'PushKit', 'CallKit', 'Security', 'AVFAudio'
 s.source_files = '**/*.{h,m,mm,swift}'
end
